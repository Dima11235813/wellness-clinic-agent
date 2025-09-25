# Wellness Clinic Concierge Agent

A minimum viable product (MVP) chatbot solution for a wellness clinic client experiencing high call volumes for simple policy questions and appointment rescheduling. This agent integrates seamlessly into their existing web application, providing 24/7 automated support while maintaining strict guardrails against hallucinated responses.

## Overview

Our client receives numerous phone calls daily about basic policy inquiries and appointment changes. This MVP demonstrates how AI can handle these routine interactions, freeing up staff for complex cases while ensuring responses are grounded in official policy documents.

![Agent Architecture Graph](./graph-architecture.png)


## Core Features

### 🤖 Policy Question & Answer
- **RAG-powered responses** using retrieval-augmented generation over the official wellness clinic policy manual
- **Hallucination guardrails** - responses must cite policy content or gracefully decline
- **Source attribution** - answers reference specific sections of the policy document

### 📅 Appointment Rescheduling
- **Interactive time slot selection** with human-in-the-loop confirmation
- **Provider preferences** support for scheduling with specific staff
- **Two-week limit** on rescheduling (longer requests escalate to human representatives)
- **Fallback escalation** when no suitable times are available

### 💬 Natural Conversation Flow
- **Intent classification** routes conversations to appropriate handlers
- **Context preservation** maintains conversation state across interactions
- **Streaming responses** provide real-time chat experience
- **Interrupt handling** for user decisions during multi-step processes

## Technical Architecture

### Backend (Node.js + LangGraph)
- **LangGraph** orchestrates conversation flow with state machines
- **LangChain** powers RAG retrieval and LLM interactions
- **In-memory vector store** for policy document embeddings
- **Express.js** API server with Server-Sent Events (SSE) streaming
- **TypeScript** for type safety across the application

### Frontend (Angular)
- **Angular Signals** for reactive state management
- **Server-Sent Events** for real-time chat streaming
- **Component-driven UI** with phase-based interface switching
- **TailwindCSS** for rapid styling and responsive design

### Key Trade-offs

| Aspect | Current MVP Approach | Trade-off/Rationale |
|--------|---------------------|-------------------|
| **Deployment** | Monolithic container | Simpler ops vs. microservices scalability |
| **Database** | In-memory vector store | Fast MVP iteration vs. production persistence |
| **Scheduling** | Stubbed time slots | Demo functionality vs. real calendar integration |
| **Evaluation** | Local LangSmith | Development testing vs. production monitoring |
| **Authentication** | None required | MVP focus vs. production security |

## Getting Started

### Prerequisites
- Node.js 18.18.0+
- OpenAI API key (for LLM and embeddings)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Add your OPENAI_API_KEY to apps/api/.env
   ```

3. **Build the application:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   npm start
   ```

   This runs the full-stack application on `http://localhost:3000`

### Development
```bash
# Run frontend and backend concurrently
npm run dev

# Build all workspaces
npm run build

# Run linter
npm run lint
```

## Deployment

### Containerization

The application is designed to run in a single Docker container containing both the Angular frontend (served as static files) and the Node.js API backend.

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/dto/package*.json ./packages/dto/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build all workspaces
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

### Google Cloud Run Configuration

```yaml
# cloud-run-service.yaml
apiVersion: serving.kniv.dev/v1
kind: Service
metadata:
  name: wellness-agent
spec:
  template:
    spec:
      containers:
      - image: gcr.io/YOUR_PROJECT/wellness-agent:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-api-key
              key: api-key
        resources:
          limits:
            memory: 1Gi
            cpu: 1000m
---
# GitHub Actions workflow for deployment
name: Deploy to Cloud Run
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and deploy
        run: |
          gcloud builds submit --tag gcr.io/$PROJECT_ID/wellness-agent
          gcloud run deploy wellness-agent \
            --image gcr.io/$PROJECT_ID/wellness-agent \
            --platform managed \
            --allow-unauthenticated \
            --port 3000 \
            --memory 1Gi \
            --cpu 1
```

## Evaluation & Testing

### Automated Evaluation Suite
The project includes comprehensive evaluation using LangSmith:

```bash
# Run all evaluations
npm run -w apps/api eval:all

# Run specific evaluation types
npm run -w apps/api eval:policy    # Policy Q&A accuracy
npm run -w apps/api eval:trajectory # Conversation flow testing
npm run -w apps/api eval:context    # Context preservation
```

### Test Coverage
- **Policy Guardrails**: Tests ensure responses are grounded in source material
- **Conversation Flows**: End-to-end testing of rescheduling workflows
- **Edge Cases**: Handling of ambiguous queries and escalation scenarios
- **UI Integration**: Playwright tests for frontend interaction patterns

## Future Roadmap

### Phase 1: Production Readiness
- [ ] **CI/CD Pipeline** with isolated frontend/backend deployments
- [ ] **Persistent Vector Database** (pgvector or Pinecone)
- [ ] **Authentication & Authorization** integration
- [ ] **Monitoring & Logging** with structured telemetry

### Phase 2: Enhanced Features
- [ ] **Multi-language Support** for diverse clinic populations
- [ ] **Voice Integration** with speech-to-text capabilities
- [ ] **Calendar System Integration** (Google Calendar, Outlook)
- [ ] **Analytics Dashboard** for conversation insights

### Phase 3: Advanced Capabilities
- [ ] **Multi-modal Inputs** (document upload, photo analysis)
- [ ] **Personalized Recommendations** based on user history
- [ ] **Integration APIs** for EHR systems and patient portals
- [ ] **Advanced Evaluation** with A/B testing frameworks

## Project Structure

```
wellness-agent/
├── apps/
│   ├── api/           # Node.js backend with LangGraph
│   └── web/           # Angular frontend
├── packages/
│   └── dto/           # Shared TypeScript types
├── data/
│   └── policies/      # Policy documents for RAG
└── eval/              # Evaluation test suites
```

## Contributing

This MVP demonstrates core AI agent capabilities for healthcare workflow automation. The modular architecture supports easy extension for additional features while maintaining strict safety guardrails appropriate for medical applications.

For questions about implementation details or extending the agent for additional use cases, please refer to:
- **Architecture Guide**: `arch.md` - Technical implementation details
- **CI/CD Documentation**: `docs/ci-cd.md` - Deployment and automation strategies
