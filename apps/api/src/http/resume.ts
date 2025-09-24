import { Router } from "express";
import { ResumeRequest } from "@wellness/dto";
import { State } from "../graph/schema.js";
import { HumanMessage } from "@langchain/core/messages";
import { threadStore } from "./chat.js";
import { getCompiledGraph } from "../graph/app.js";

export const resumeRouter = Router();

/**
 * POST /api/resume
 * Resume a paused flow at an interrupt with a structured payload.
 */
resumeRouter.post("/resume", async (req, res) => {
  const { threadId, response }: ResumeRequest = req.body;

  if (!threadId) {
    return res.status(400).json({ error: 'threadId required' });
  }

  try {
    const currentState = threadStore.get(threadId);
    if (!currentState) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Apply the user response to the state and continue execution
    if (response?.kind === 'StartSuggest') {
      // Handle StartSuggest response - either chip selection or free text
      const startSuggestResponse = response as { kind: 'StartSuggest'; chipKey?: string; text?: string };
      if (startSuggestResponse.chipKey) {
        (currentState as any).startSuggestion = startSuggestResponse.chipKey;
      } else if (startSuggestResponse.text) {
        // Add the text as a new user message
        const userMessage = new HumanMessage({
          content: startSuggestResponse.text,
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString()
          }
        });
        currentState.messages = [...currentState.messages, userMessage];
      }
      (currentState as any).interrupt = undefined;
    } else if (response?.kind === 'SelectTime') {
      currentState.selectedSlotId = response.slotId as any;
      (currentState as any).interrupt = undefined;
    } else if (response?.kind === 'ConfirmTime') {
      (currentState as any).userConfirmed = response.confirm;
      (currentState as any).interrupt = undefined;
    }

    // Store the updated state
    threadStore.set(threadId, currentState);

    // Continue graph execution after resume, streaming progressive updates
    try {
      const compiledGraph = getCompiledGraph();
      if (!compiledGraph) {
        return res.status(503).json({ error: 'Graph not ready' });
      }

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      try { (res as any).flushHeaders?.(); } catch {}

      const stream = await compiledGraph.stream(currentState, {
        streamMode: 'values',
        configurable: { thread_id: threadId }
      });

      let keepAlive: NodeJS.Timeout | null = setInterval(() => {
        try { res.write(`:\n\n`); } catch {}
      }, 15000);

      for await (const stateChunk of stream as any) {
        const eventData = {
          type: 'state',
          data: {
            messages: (stateChunk as any).messages,
            uiPhase: (stateChunk as any).uiPhase,
            interrupt: (stateChunk as any).interrupt,
            threadId,
            availableSlots: (stateChunk as any).availableSlots
          }
        };
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);

        // Persist progressive state
        try { threadStore.set(threadId, stateChunk); } catch {}

        if ((stateChunk as any).interrupt) {
          const interruptData = { type: 'interrupt', data: (stateChunk as any).interrupt };
          res.write(`data: ${JSON.stringify(interruptData)}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      try { if (keepAlive) clearInterval(keepAlive); } catch {}
      res.end();

    } catch (error) {
      console.error('[api] Resume execution error:', error);
      res.status(500).json({ error: 'Failed to continue conversation' });
    }

  } catch (error) {
    console.error('[api] Resume error:', error);
    res.status(500).json({ error: 'Failed to resume conversation' });
  }
});
