# Wellness Concierge Agent – Architecture Guide

This document is the **source of truth** for the MVP implementation of the
Wellness Clinic Concierge Agent using **LangGraph**, **LangChain**, and **Angular**.

---

## 1. Goal & Core Features

- Let clinic members **reschedule appointments** via chat.
- Allow follow-up **policy Q&A** using a RAG (retrieval-augmented generation) pipeline
  over the official **UND Wellness Center Participant Policy Manual (2025)**.
- Support **human-in-the-loop (HITL)** interrupts for:
  - Selecting a new time slot.
  - Confirming a selected slot.
  - Handling “none of these work” → escalate to a human representative.
- Enforce **guardrails**:  
  Policy questions must be answered **only** from the embedded policy database.

---

## 2. Repository Layout (Monorepo)
```

wellness-agent/
├── apps/
│ ├── api/ # Node + Express/Fastify + LangGraph/LangChain
│ └── web/ # Angular front end
├── packages/
│ ├── dto/ # Shared TypeScript types and DTOs
│ └── ui/ # (optional) shared UI primitives/styles
├── data/
│ └── policies/
│ └── whp-participant-policy-manual-2025.pdf
├── var/
│ └── vector/ # local vector DB storage (currently in-memory)
├── eval/
│ └── clinic-policy-evals.json
└── arch.md # this file

````

---

## 3. Backend (apps/api)

### 3.1 LangGraph Nodes & Edges

| Node | Role | Key Edges |
|------|------|-----------|
| **Start** | Greet user; route to `PolicyQuestion` or `RescheduleRequest`. | → `PolicyQuestion` or `CollectRequest` |
| **PolicyQuestion** | Accept user policy queries. | → `PolicyAnswer` |
| **PolicyAnswer** | Use RAG retrieval on vector store. If no relevant chunk, send guardrail message. | conditional → back to `PolicyQuestion` |
| **CollectRequest** | Gather desired date/time and provider preferences. | → `CheckAvailability` |
| **CheckAvailability** | Query or stub scheduling API for open slots (max 2 weeks out). | conditional → `OfferOptions` (slots found) or `EscalateHuman` |
| **OfferOptions** | Interrupt: present a list of available time slots. | → `ConfirmTime` (slot chosen) or `EscalateHuman` (none) |
| **ConfirmTime** | Interrupt: ask Yes/No confirmation. | conditional → `NotifyUser` (yes) or back to `OfferOptions` (no) |
| **NotifyUser** | Confirm booking to user. | → `PolicyQuestion` |
| **EscalateHuman** | Notify that a representative will call within 15 min; set `availableTimesDoNotWork = true`. | → `PolicyQuestion` |

Mermaid overview:

```mermaid
graph TD
  Start --> PolicyQuestion
  Start --> CollectRequest
  PolicyQuestion --> PolicyAnswer
  PolicyAnswer -->|no context| PolicyQuestion
  CollectRequest --> CheckAvailability
  CheckAvailability -->|slots found| OfferOptions
  CheckAvailability -->|none| EscalateHuman
  OfferOptions -->|slot selected| ConfirmTime
  OfferOptions -->|none of these| EscalateHuman
  ConfirmTime -->|yes| NotifyUser
  ConfirmTime -->|no| OfferOptions
  NotifyUser --> PolicyQuestion
  EscalateHuman --> PolicyQuestion
````

### 3.2 Guardrails

- `PolicyAnswer` validates that RAG retrieval returns relevant text.
  If no chunk meets the similarity threshold:
  - Respond:
    _“I can only answer questions about the wellness clinic’s policies or help reschedule an appointment. Would you like to ask a different question or talk to a representative?”_
  - Conditional edge loops back to `PolicyQuestion`.

- Evals include **jailbreak attempts** to prove this works.

### 3.3 Knowledge Base Ingestion

- At **app start**, call `ingestPolicies()`:
  - Uses `PDFLoader` + `RecursiveCharacterTextSplitter`.
  - Stores chunks with `filename`, `pageNumber`, `chunkIndex`, `lastIngestedAt`, and a mirrored `content` field in **vector store**.
  - Deletes old chunks by `filename` before inserting (idempotent).

### 3.4 APIs

| Endpoint      | Method    | Purpose                                                  |
| ------------- | --------- | -------------------------------------------------------- |
| `/api/stream` | GET (SSE) | Streams LangGraph output and interrupt events.           |
| `/api/resume` | POST      | Resume after a HITL interrupt with `ResumeRequest`.      |
| `/api/chat`   | POST      | Initial chat messages (if not using SSE from the start). |

---

## 4. Shared Types (packages/dto)

```ts
export type UiPhase = 'Chatting' | 'SelectingTime' | 'ConfirmingTime' | 'Escalated' | 'PolicyQA';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}
export interface TimeSlot {
  id: string;
  startISO: string;
  endISO: string;
  provider?: string;
}

export interface InterruptPayload {
  kind: 'SelectTime' | 'ConfirmTime';
  slots?: TimeSlot[];
  selectedSlotId?: string;
  reason?: string;
}

export interface ResumeRequest {
  threadId: string;
  response:
    | { kind: 'SelectTime'; slotId: string | 'none' }
    | { kind: 'ConfirmTime'; confirm: boolean };
}
```

These are consumed by **both** Angular and Node.

---

## 5. Frontend (apps/web)

### 5.1 Tech

- Angular (latest) + Signals
- TailwindCSS (or Angular Material) for rapid styling
- SSE for chat streaming
- Shared DTO imports from `packages/dto`

### 5.2 Page Structure

```
app/
  core/
    services/
      chat-sse.service.ts    # opens SSE connection
      api.service.ts         # resume(), etc.
      app-state.store.ts     # signals: messages, uiPhase, interrupt
  features/
    chat/
      chat-page.component.ts|html
      message-list.component.ts|html
      message-input.component.ts|html
      interrupt-panels/
        time-options-card.component.ts|html
        confirm-time-card.component.ts|html
        fallback-card.component.ts|html
        policy-qa-card.component.ts|html
```

### 5.3 UI Phases (1:1 with Graph)

| Phase            | View                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `Chatting`       | Normal chat input enabled.                                                |
| `SelectingTime`  | `TimeOptionsCard`: grid of available slots + “None of these work for me.” |
| `ConfirmingTime` | `ConfirmTimeCard`: Yes/No buttons, input disabled.                        |
| `Escalated`      | `FallbackCard`: “Rep will contact within 15 min.”                         |
| `PolicyQA`       | `PolicyQACard`: suggestions + free text for policy queries.               |

### 5.4 Component Highlights

**TimeOptionsCard**

- Groups slots by date.
- Buttons for each slot.
- Secondary button: **None of these work for me** → triggers escalation.

**ConfirmTimeCard**

- Shows selected slot.
- Yes → confirm and book.
- No → return to time selection.

**FallbackCard**

- Notifies about representative call.
- Calls `appState.resetForPolicy()` to continue with policy questions.

**PolicyQACard**

- Suggests common policy queries as clickable chips.
- Normal chat input resumes.

---

## 6. Evaluation Plan (eval/clinic-policy-evals.json)

- \~16 representative test cases:
  - Membership & cancellation rules
  - Facility safety & area-specific policies
  - Scheduling/rescheduling flows
  - Guardrail check with **jailbreak attempt**

Example entry:

```json
{
  "input": "Can I use dumbbells on the indoor track?",
  "expected": "No. Track is limited to walking, jogging, or running only.",
  "contextPolicyRequired": true
}
```

LangSmith command:

```bash
npx langsmith eval run ./eval/clinic-policy-evals.json
```

---

## 7. Deployment & CI/CD

**Option A: All-in Cloud Run (recommended)**

- One Docker image:
  - Serves Angular build as static files.
  - Hosts Node + LangGraph API and SSE endpoints.

- Rebuild embeddings on boot or use persistent vector database (pgvector, etc.).

**Option B: Hybrid (optional)**

- Angular static site on Vercel
- API on Cloud Run
- Requires CORS management.

GitHub Actions for Cloud Run:

```yaml
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & deploy
        run: |
          gcloud builds submit --tag gcr.io/$PROJECT_ID/wellness-agent
          gcloud run deploy wellness-agent --image gcr.io/$PROJECT_ID/wellness-agent --platform managed --allow-unauthenticated
```

---

## 8. Key Product Rules

- **Two-week reschedule cap**: All available times must be ≤ 14 days from today.
  Longer requests escalate to a representative.
- **State flag**: `availableTimesDoNotWork = true` triggers the fallback node and
  stores context for the human team.
- **Policy-only guarantee**: All answers to policy questions must cite content from
  the ingested PDF or decline.

---

## 9. Next Steps in Cursor

1. **Bootstrap repo** with this structure.
2. Implement LangGraph nodes (one file per node) and confirm with unit tests.
3. Build Angular skeleton with Signals store and streaming service.
4. Connect SSE and resume endpoints end-to-end.
5. Run LangSmith eval suite and verify guardrail responses.

---

TODO Update this document with the actual implementation details.
This document will evolve with implementation but should remain the **canonical design contract** for both engineering and review.