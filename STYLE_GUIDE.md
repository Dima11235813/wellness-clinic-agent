# Wellness Clinic Agent - LangGraph Style Guide

This document outlines the patterns and conventions for implementing the Wellness Clinic Agent using LangGraph, LangChain, and LangSmith.

## Architecture Overview

Our implementation follows a structured approach using:

- **LangGraph**: For building the conversational graph with proper state management
- **LangChain**: For LLM integrations and tool usage
- **LangSmith**: For observability, tracing, and monitoring
- **TypeScript**: For type safety and better developer experience

## Core Patterns

### 1. Dependency Injection (Deps Pattern)

All dependencies are injected through a centralized `Deps` interface:

```typescript
export interface Deps {
  llm: BaseChatModel; // ChatOpenAI instance
  logger: Logger; // Structured logging interface
  // Future deps:
  // embeddings: Embeddings;
  // retriever: RetrieverLike;
  // tracer: LangSmithTracer;
}
```

**Benefits:**
- Easy testing with mock dependencies
- Clear dependency boundaries
- Configurable LLM providers
- Structured logging throughout

### 2. State Management with Annotations

Use LangGraph's `Annotation.Root` for type-safe state:

```typescript
export const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Simple fields (overwrite on update)
  userQuery: Annotation<string>(),
  intent: Annotation<'policy' | 'reschedule'>(),

  // Array fields (append with reducer)
  availableSlots: Annotation<TimeSlot[]>({
    default: () => [],
    reducer: (left, right) => [...left, ...right],
  }),

  // Optional fields
  selectedSlotId: Annotation<string | undefined>(),
});
```

**Key Rules:**
- Use `messagesStateReducer` for message arrays
- Define reducers for arrays that should append/merge
- Use `default: () => []` for array fields
- Use `Annotation<T | undefined>()` for optional fields

### 3. Node Factory Pattern

All nodes are factory functions that take `Deps` and return the actual node function:

```typescript
export function makeStartNode({ logger }: Deps) {
  return async function startNode(state: State) {
    logger.info('startNode: Processing user input');

    const latestMessage = state.messages[state.messages.length - 1];
    if (latestMessage.role === 'user') {
      // Process user input and determine intent
      const intent = determineIntent(latestMessage.text);

      return {
        userQuery: latestMessage.text,
        intent,
        uiPhase: 'Chatting'
      };
    }

    return {};
  };
}
```

**Naming Convention:** `make<NodeName>Node`
**Benefits:**
- Dependency injection per node
- Easy testing with mocks
- Consistent logging patterns
- Clear separation of concerns

### 4. Graph Construction Pattern

Use `StateGraph` with proper node and edge definitions:

```typescript
export function buildGraph(deps: Deps) {
  const builder = new StateGraph(StateAnnotation)
    // Register nodes
    .addNode(NodeName.START, makeStartNode(deps))
    .addNode(NodeName.POLICY_QUESTION, makePolicyQuestionNode(deps))
    .addNode(NodeName.COLLECT_REQUEST, makeCollectRequestNode(deps))
    // ... more nodes

    // Define edges
    .addEdge(NodeName.START, NodeName.POLICY_QUESTION)
    .addEdge(NodeName.START, NodeName.COLLECT_REQUEST)

    // Conditional edges
    .addConditionalEdges(
      NodeName.CHECK_AVAILABILITY,
      routeAfterAvailabilityCheck(deps),
      [NodeName.OFFER_OPTIONS, NodeName.ESCALATE_HUMAN]
    );

  return builder;
}
```

### 5. Routing Functions

Create pure functions for conditional routing:

```typescript
export function routeAfterAvailabilityCheck({ logger }: Deps) {
  return (state: State) => {
    if (!state.availableSlots || state.availableSlots.length === 0) {
      logger.info('No slots available, escalating to human');
      return NodeName.ESCALATE_HUMAN;
    }

    logger.info(`Found ${state.availableSlots.length} slots, offering options`);
    return NodeName.OFFER_OPTIONS;
  };
}
```

### 6. Command Pattern for State Updates

Use LangGraph's `Command` for complex state updates and routing:

```typescript
import { Command } from '@langchain/langgraph';

export function makeOfferOptionsNode({ logger }: Deps) {
  return async function offerOptionsNode(state: State) {
    if (!state.availableSlots?.length) {
      return new Command({
        goto: NodeName.ESCALATE_HUMAN,
        update: {
          availableTimesDoNotWork: true,
          escalationNeeded: true
        }
      });
    }

    // For interrupt scenarios, return Command with goto
    return new Command({
      update: {
        uiPhase: 'SelectingTime',
        interrupt: {
          kind: InterruptKind.SelectTime,
          slots: state.availableSlots,
          requiresUserAction: true
        }
      }
    });
  };
}
```

### 7. Interrupt Handling

Use LangGraph's `interrupt` function for user interactions:

```typescript
import { interrupt } from '@langchain/langgraph';

export function makeOfferOptionsInterrupt({ logger }: Deps) {
  return async function offerOptionsInterrupt(state: State) {
    const result = interrupt({
      task: 'Select an appointment slot',
      slots: state.availableSlots
    });

    return {
      selectedSlotId: result.slotId,
      interrupt: undefined // Clear interrupt after handling
    };
  };
}
```

### 8. Logging and Observability

Implement structured logging throughout:

```typescript
export interface Logger {
  debug: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
}

// Usage in nodes:
export function makePolicyAnswerNode({ llm, logger }: Deps) {
  return async function policyAnswerNode(state: State) {
    logger.info('policyAnswerNode: Starting RAG retrieval', {
      userQuery: state.userQuery,
      messageCount: state.messages.length
    });

    try {
      // LLM call logic here
      const response = await llm.invoke(prompt);

      logger.info('policyAnswerNode: RAG retrieval successful', {
        responseLength: response.content.length,
        hasRelevantContext: true
      });

      return {
        messages: [...state.messages, response],
        uiPhase: 'PolicyQA'
      };
    } catch (error) {
      logger.error('policyAnswerNode: RAG retrieval failed', {
        error: error.message,
        userQuery: state.userQuery
      });

      // Return guardrail message
      return {
        messages: [...state.messages, guardrailMessage],
        uiPhase: 'Chatting'
      };
    }
  };
}
```

## Node-Specific Patterns

### Policy Nodes
- Use RAG retrieval with proper error handling
- Implement guardrails for off-topic queries
- Log retrieval success/failure metrics

### Scheduling Nodes
- Handle interrupt-based UI interactions
- Validate slot selections
- Implement escalation logic for edge cases

### State Management Rules

1. **Messages**: Always append new messages to existing array
2. **Flags**: Use boolean flags for routing decisions (`escalationNeeded`, `availableTimesDoNotWork`)
3. **Optional Fields**: Use `undefined` for unset values, not `null`
4. **Arrays**: Use reducers for append-only arrays (messages, slots, etc.)

## Testing Patterns

### Unit Testing Nodes
```typescript
describe('makeStartNode', () => {
  it('should determine intent from user message', async () => {
    const mockLogger = { info: vi.fn() };
    const deps = { logger: mockLogger } as Deps;

    const startNode = makeStartNode(deps);
    const state = {
      messages: [{ role: 'user', text: 'I need to reschedule my appointment' }]
    } as State;

    const result = await startNode(state);

    expect(result.intent).toBe('reschedule');
    expect(mockLogger.info).toHaveBeenCalledWith('startNode: Processing user input');
  });
});
```

### Integration Testing Graph
```typescript
describe('WellnessClinicGraph', () => {
  it('should handle policy question flow', async () => {
    const graph = buildGraph(mockDeps);
    const compiled = graph.compile();

    const result = await compiled.invoke({
      messages: [{ role: 'user', text: 'What is the cancellation policy?' }]
    });

    expect(result.intent).toBe('policy');
    expect(result.uiPhase).toBe('PolicyQA');
  });
});
```

## Configuration Management

Use Zod for runtime configuration validation:

```typescript
import { z } from 'zod';

const Config = z.object({
  OPENAI_API_KEY: z.string().min(1),
  MODEL: z.string().default('gpt-4o-mini'),
  TIMEOUT_MS: z.coerce.number().default(60_000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LANGSMITH_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof Config>;

export function loadConfig(): AppConfig {
  return Config.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MODEL: process.env.MODEL,
    TIMEOUT_MS: process.env.TIMEOUT_MS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
  });
}
```

## Error Handling

Implement comprehensive error handling:

```typescript
export function makePolicyAnswerNode({ llm, logger }: Deps) {
  return async function policyAnswerNode(state: State) {
    try {
      // Core logic here
      return result;
    } catch (error) {
      logger.error('Node execution failed', {
        node: 'policyAnswer',
        error: error.message,
        stack: error.stack,
        state: { ...state, messages: '[TRUNCATED]' } // Avoid logging full messages
      });

      // Return safe fallback state
      return {
        messages: [...state.messages, fallbackMessage],
        uiPhase: 'Chatting',
        error: true
      };
    }
  };
}
```

## Performance Considerations

1. **LLM Call Optimization**: Cache responses for common queries
2. **State Size**: Avoid storing large objects in state
3. **Memory Management**: Use streaming for large responses
4. **Timeout Handling**: Implement proper timeouts for all async operations

## Observability with LangSmith

```typescript
import { LangSmithTracer } from 'langsmith/tracers';

export interface Deps {
  llm: BaseChatModel;
  logger: Logger;
  tracer: LangSmithTracer;
}

// In node functions:
export function makeSomeNode({ llm, logger, tracer }: Deps) {
  return async function someNode(state: State) {
    return tracer.trace(async () => {
      logger.info('Starting node execution');
      const result = await llm.invoke(prompt);
      logger.info('Node execution completed');
      return result;
    }, { name: 'someNode', metadata: { userId: state.userId } });
  };
}
```

This style guide ensures consistent, maintainable, and observable code throughout the Wellness Clinic Agent implementation.
