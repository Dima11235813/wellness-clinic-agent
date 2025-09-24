## Nodes and Tools — LangGraph Best Practices

This document explains how we add tools and nodes to the Wellness Clinic Agent, following LangGraph best practices for LLMs that can call tools.

### TL;DR
- **State** lives in `apps/api/src/graph/schema.ts` using `Annotation`.
- **Tools** live in `apps/api/src/graph/tools/*` and are exported/collected in `apps/api/src/graph/tools/index.ts`.
- **Nodes** are factory functions under `apps/api/src/graph/nodes/*` that receive `Deps` (LLM, logger, tools).
- **Graph** is wired in `apps/api/src/graph/buildGraph.ts` with conditional edges in `apps/api/src/graph/routing.ts`.
- Prefer: bind tools to the LLM in nodes that need tool-use decisions, or call tools directly for deterministic steps.

---

### Minimal example: agent with tools (from LangGraph patterns)

```typescript
// agent.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Annotation } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";

// Define the state of our graph using Annotation
// It tracks the messages in the conversation
export const AgentState = Annotation.Root({
  messages: Annotation.of<Array<BaseMessage>>({
    reducer: (x, y) => y ?? x,
  }),
});
export type AgentState = typeof AgentState.type;

// Define a tool with a schema for validation and a clear description
const get_weather = tool(
  async ({ location }: { location: string }): Promise<string> => {
    // This is a dummy implementation
    return `The weather in ${location} is 60F and foggy.`;
  },
  {
    name: "get_weather",
    description: "Fetches the current weather for a given location.",
    schema: z.object({
      location: z.string().describe("The location to get the weather for."),
    }),
  }
);

export const tools = [get_weather];
```

```typescript
// agent.ts (continued)
import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  ToolMessage,
  isAIMessage,
} from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Bind the tools to your LLM so it knows how and when to use them
const llmWithTools = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
}).bindTools(tools);

// The agent node, which invokes the LLM
const agentNode = async (state: AgentState) => {
  const result = await llmWithTools.invoke(state.messages);
  return {
    messages: [result],
  };
};

// The router function to decide the next step
const router = (state: AgentState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  // Check if the LLM has called a tool
  if (isAIMessage(lastMessage) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  // Otherwise, the conversation can end
  return END;
};
```

This pattern lets the LLM decide when to call tools, with input/output handled through `messages`.

---

### How this maps to our project

- State: `apps/api/src/graph/schema.ts` defines `StateAnnotation`, including `messages`, `userQuery`, `intent`, scheduling/policy fields, and flags.
- LLM: `apps/api/src/graph/llm.ts` creates the `ChatOpenAI` instance from config.
- Deps: `apps/api/src/graph/app.ts` composes `llm`, `logger`, and `tools` into `Deps`.
- Tools: `apps/api/src/graph/tools/*` defines tools; `apps/api/src/graph/tools/index.ts` exports individual tools, `tools` array, and a `createTools(llm?)` wrapper for convenience.
- Nodes: `apps/api/src/graph/nodes/*` exports `makeXNode(deps)` factories that return the actual node function.
- Graph: `apps/api/src/graph/buildGraph.ts` wires nodes and conditional routing with `NodeName`.

Example references:
- Intent inference tool: `apps/api/src/graph/tools/intentInference.ts`
- Infer intent node: `apps/api/src/graph/nodes/inferIntent.ts`
- Graph wiring: `apps/api/src/graph/buildGraph.ts`

---

### Adding a new tool

1) Create a file in `apps/api/src/graph/tools/yourTool.ts` using `tool` (recommended) or our existing pattern.

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const exampleTool = tool(
  async ({ input }: { input: string }) => {
    // Do work here (API call, DB, business logic)
    return { ok: true, echo: input };
  },
  {
    name: "example_tool",
    description: "Explains what this tool does and when to use it.",
    schema: z.object({
      input: z.string().describe("Free-form input to process."),
    }),
  }
);
```

2) Export and register it in `apps/api/src/graph/tools/index.ts`:
- Add `export { exampleTool } from './yourTool.js'`.
- Add to the `tools` array if you will bind it to the LLM.
- Optionally expose a convenience method inside `createTools` if you want to call it directly from nodes.

3) If the tool requires the LLM:
- Bind it by passing the `llm` when creating tools so nodes can do `llm.bindTools(tools)`.
- Or accept an `llm` param in your tool wrapper and pass it from `Deps.tools` (see `intentInferenceTool.invoke(args, llm)`).

Best practices:
- **Validate inputs** with `zod` schemas.
- **Describe** the tool clearly so the LLM knows when to use it.
- **Return structured outputs** that nodes can route on deterministically.

---

### Adding a new node

1) Create `apps/api/src/graph/nodes/myNode.ts` as a factory that accepts `Deps`:

```typescript
import { Command } from "@langchain/langgraph";
import { State } from "../schema.js";
import { Deps } from "../deps.js";

export function makeMyNode({ llm, logger, tools }: Deps) {
  return async function myNode(state: State) {
    logger.info("myNode: starting");

    // Option A: Deterministic tool call
    const result = await tools.exampleTool.invoke({ input: state.userQuery ?? "" });

    // Option B: Let the LLM decide tool calls
    // const llmWithTools = llm.bindTools([/* tools to expose */]);
    // const ai = await llmWithTools.invoke(state.messages);

    return new Command({
      update: {
        // Update state fields (messages, intent, etc.)
      },
    });
  };
}
```

2) Add the node in `buildGraph.ts` with `.addNode(NodeName.MY_NODE, makeMyNode(deps))` and wire edges or conditional edges in `routing.ts`.

3) Keep routing deterministic: base transitions on state (e.g., `state.intent`) rather than free-form strings.

---

### Using ToolNode and LLM-bound tools inside a node

When a node should let the LLM decide which tool to call:

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

export function makeAgenticNode({ llm, tools, logger }: Deps) {
  const toolList = [/* select tools to expose */];
  const llmWithTools = (llm as any).bindTools(toolList);

  return async function agenticNode(state: State) {
    const ai = await llmWithTools.invoke(state.messages);
    return { messages: [ai] };
  };
}

// In buildGraph.ts, add a ToolNode to handle actual tool execution
// const toolNode = new ToolNode({ tools: toolList });
// builder.addNode("tools", toolNode);
// and route to "tools" when `isAIMessage(last).tool_calls.length > 0`.
```

This mirrors the minimal example and keeps the LLM/tool-call interplay in a single place. For steps that are purely procedural (e.g., fetching availability given user choices), call tools directly for predictability.

---

### Concrete example in this codebase

- `apps/api/src/graph/tools/intentInference.ts` now exports `getUserIntent` (a LangChain tool named `get_user_intent`) which returns a structured intent. It can be called by the LLM via ToolNode, or directly via the compatibility wrapper `intentInferenceTool`.

```typescript
// inferIntent.ts (excerpt)
import { agentTools } from "../tools.js";

export function makeInferIntentNode({ llm, logger }: Deps) {
  return async function inferIntentNode(state: State) {
    const last = state.messages[state.messages.length - 1] as ToolMessage | undefined;
    if (last && (last as any).name === 'get_user_intent') {
      const { intent } = JSON.parse(String(last.content));
      return new Command({ update: { intent } });
    }
    const llmWithTools = (llm as any).bindTools(agentTools);
    const ai = await llmWithTools.invoke(state.messages);
    return { messages: [ai] };
  };
}
```

Graph wiring includes a `tools` node:

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { agentTools } from "./tools.js";

builder
  .addNode(NodeName.INFER_INTENT, makeInferIntentNode(deps))
  .addNode('tools' as any, new ToolNode({ tools: agentTools }))
  .addConditionalEdges(
    NodeName.INFER_INTENT,
    routeAfterInferIntent(deps),
    ['tools' as any, NodeName.POLICY_QUESTION, NodeName.OFFER_OPTIONS]
  );
```

Routing function detects `tool_calls` and routes to `tools`, then back to `infer_intent` once the tool result is present.

---

### Checklist

- Validate tool inputs with `zod`.
- Prefer `llm.bindTools([...])` when the LLM should decide tool usage; otherwise call tools directly.
- Keep routing deterministic using state fields and `addConditionalEdges`.
- Always log inputs/outputs at node boundaries.
- Clamp confidences, handle errors, and provide fallbacks (see `intentInferenceTool` and `inferIntent` node).


