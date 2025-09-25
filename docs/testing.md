# Testing Documentation

## End-to-End Testing

### Chat Streaming Tests

The application includes Playwright-based end-to-end tests that validate the chat streaming functionality between the Angular frontend and Node.js backend.

#### Test Suite: `apps/web/tests/chat-streaming.spec.ts`

**Configuration:**
- Browser: Chromium (Desktop Chrome)
- Base URL: `http://localhost:4200`
- Web server: Automatically starts the full-stack application (`npm run start`)
- Test isolation: Fully parallel execution

#### Test Cases

##### 1. "should display correct responses when multiple messages are sent"

**Purpose:** Validates that assistant responses appear correctly when multiple user messages are sent in sequence.

**Test Flow:**
1. Navigate to `/?debug=mock` (enables mock API responses)
2. Wait for chat interface to load
3. Send first message: "Can I cancel anytime without financial penalty"
4. Wait for first assistant response (expects policy-related content)
5. Send second message: "What kind of shoes can I wear?"
6. Wait for second assistant response (expects shoe-related content)
7. Verify message counts: 2 user messages, 2 assistant messages
8. Verify content separation (second response should not contain "cancel" text)

**Expected Behavior:**
- User messages appear immediately in the UI
- Assistant responses stream in and display progressively
- Each assistant response is contextually appropriate to its corresponding user message
- Message history is maintained correctly across multiple exchanges

##### 2. "should maintain message history correctly across streams"

**Purpose:** Validates that conversation context and message history are preserved across multiple streaming responses.

**Test Flow:**
1. Navigate to `/?debug=mock`
2. Wait for chat interface to load
3. Send first message: "Hello"
4. Wait for first assistant response
5. Send second message: "How are you?"
6. Wait for second assistant response
7. Verify message counts: 2 user messages, 2 assistant messages
8. Verify specific message content is preserved

**Expected Behavior:**
- All user messages remain visible
- All assistant responses remain visible
- No messages are lost or duplicated
- Message order is maintained

#### Test Architecture

**Frontend UI Selectors:**
- Chat input: `mat-form-field input[matInput]`
- User messages: `.message.user`
- Assistant messages: `.message.assistant`
- Send button: `button` (disabled when input is empty)

**Mock Mode (`?debug=mock`):**
- Bypasses real API calls to LangGraph
- Uses static responses for consistent testing
- Allows testing UI behavior without LLM dependencies

#### Current Test Status: ❌ FAILING

Both tests are currently failing because **assistant messages are not appearing in the chat interface**.

**Failure Symptoms:**
- User messages appear correctly
- Assistant responses are not visible in `.message.assistant` elements
- Tests timeout waiting for assistant messages to appear
- Message counts show 2 user messages but 0 assistant messages

**Root Cause Analysis:**

The issue appears to be in the message filtering logic in `apps/web/src/app/state/app-state.store.ts`. The frontend filters incoming messages to exclude `ToolMessage`s but include `AIMessage`s, however there may be a bug in the message ID matching or role determination logic.

**Key Code Locations:**
- **Frontend message filtering:** `apps/web/src/app/state/app-state.store.ts:367-376`
- **Message mapping:** `apps/web/src/app/state/app-state.store.ts:306-347`
- **Backend message creation:** Various nodes create `AIMessage` instances
- **Streaming endpoint:** `apps/api/src/index.ts:218-243`

#### Running the Tests

**Prerequisites:**
- Node.js 18.18.0+
- OpenAI API key (for backend, even in mock mode)

**Commands:**
```bash
# Install dependencies
npm install

# Run e2e tests
cd apps/web
npx playwright test

# Run with UI for debugging
npx playwright test --ui

# Run specific test
npx playwright test chat-streaming.spec.ts --grep "multiple messages"

# View test results
npx playwright show-report
```

**Debug Mode:**
- Tests run with `--debug=mock` URL parameter
- This bypasses real LLM calls for consistent testing
- Backend still processes requests but returns mock responses

#### Next Steps for Fixing

1. **Debug message streaming:** Add logging to track message flow from backend to frontend
2. **Inspect message filtering:** Verify the `assistantOnly` filter logic is working correctly
3. **Check message serialization:** Ensure LangChain messages are properly serialized/deserialized
4. **Test message mapping:** Verify `toChatMessage` function correctly identifies assistant messages
5. **Validate mock mode:** Confirm mock responses are being generated and streamed

#### Test Coverage Gaps

- **Error handling:** Network failures, malformed responses
- **Streaming interruptions:** Connection drops, partial messages
- **UI state synchronization:** Interrupt handling, phase transitions
- **Performance:** Large conversation histories, rapid message sequences
- **Mobile responsiveness:** Different screen sizes and orientations

---

## Other Test Types

### Evaluation Tests (Backend)

**Location:** `apps/api/eval/`

**Purpose:** Automated evaluation of agent performance using LangSmith

**Test Types:**
- **Trajectory evaluation:** Validates conversation flow patterns
- **Policy evaluation:** Tests accuracy of policy Q&A responses
- **Context evaluation:** Checks context preservation across conversations

**Running evaluations:**
```bash
# Run all evaluations
npm run -w apps/api eval:all

# Run specific evaluation types
npm run -w apps/api eval:policy
npm run -w apps/api eval:trajectory
npm run -w apps/api eval:context
```

### Unit Tests

**Frontend:** Angular Karma/Jasmine tests (minimal coverage currently)
**Backend:** No dedicated unit tests (logic embedded in integration-style evaluation tests)

---

## Development Workflow

1. **Local development:** `npm run dev` (runs frontend + backend concurrently)
2. **Test iteration:** Make changes, run e2e tests with `npx playwright test`
3. **Debug failures:** Use `--ui` flag or browser dev tools
4. **Fix validation:** Ensure both test cases pass before committing
5. **CI validation:** Tests run automatically on push to main branch
