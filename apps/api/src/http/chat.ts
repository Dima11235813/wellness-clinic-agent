import { Router } from "express";
import { v4 as uuid } from "uuid";
import { ChatStartRequest, ChatStartResponse, UiPhase } from "@wellness/dto";
import { State, StateAnnotation } from "../graph/schema.js";
import { HumanMessage } from "@langchain/core/messages";
import { createGraphService } from "../graph/graph-service.js";

export const chatRouter = Router();

// In-memory store for development (TODO use Redis/DB in production)
export const threadStore = new Map<string, State>();

/**
 * POST /api/chat
 * Starts or continues the flow with a free-form user text.
 * Kicks off the graph (which will soon emit StartSuggest interrupt if that's the first node).
 */
chatRouter.post("/chat", async (req, res) => {
  const body = req.body as ChatStartRequest;
  const threadId = body.threadId ?? `thread_${Date.now()}`;

  if (!body.text || typeof body.text !== 'string') {
    return res.status(400).json({ error: 'text parameter required' });
  }

  try {
    // Store the initial user message for the streaming endpoint
    const userMessage = new HumanMessage({
      content: body.text,
      id: `msg_${Date.now()}`,
      additional_kwargs: {
        at: new Date().toISOString()
      }
    });

    // Get existing thread state or initialize new one
    let currentState: State = threadStore.get(threadId) || {
      messages: [],
      threadId: threadId,
      uiPhase: UiPhase.Chatting,
      interrupt: undefined,
      availableSlots: [],
      userQuery: body.text,
      intent: 'unknown' as const,
      userEscalated: false,
      userKey: threadId,
      userChoice: undefined,
      preferredDate: '',
      preferredProvider: '',
      selectedSlotId: '',
      eventId: '',
      retrievedDocs: [],
      validatedAswer: '',
      availableTimesDoNotWork: false,
      twoWeekCapExceeded: false,
      escalationNeeded: false
    } as State;

    // Append new message to existing conversation history
    currentState.messages = [...currentState.messages, userMessage];
    // Update userQuery with the latest message
    currentState.userQuery = body.text;
    threadStore.set(threadId, currentState);

    const resp: ChatStartResponse = { threadId, accepted: true };
    res.status(202).json(resp);

  } catch (error) {
    console.error('[api] Chat start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});
