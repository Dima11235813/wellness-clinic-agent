import { State, StateAnnotation } from './schema.js';
import { threadStore } from '../http/chat.js';
import { UiPhase } from '@wellness/dto';

/**
 * Service for handling LangGraph operations
 */
export class GraphService {
  private compiledGraph: any = null;

  constructor(compiledGraph: any) {
    this.compiledGraph = compiledGraph;
  }

  /**
   * Execute the graph for a given thread and return the final state
   */
  async executeGraph(threadId: string): Promise<State> {
    if (!this.compiledGraph) {
      throw new Error('Graph not ready');
    }

    // Get existing thread state
    const currentState = threadStore.get(threadId);
    if (!currentState) {
      throw new Error('Thread not found. Please start a conversation first.');
    }

    // Execute the graph using LangGraph's invoke method with checkpointer thread id
    const finalState = await this.compiledGraph.invoke(currentState, {
      configurable: { thread_id: threadId }
    });

    // Update stored state
    threadStore.set(threadId, finalState);

    return finalState;
  }

  /**
   * Stream the graph for a given thread, yielding progressive state updates
   */
  async streamGraph(threadId: string): Promise<AsyncIterable<any>> {
    if (!this.compiledGraph) {
      throw new Error('Graph not ready');
    }

    const currentState = threadStore.get(threadId);
    if (!currentState) {
      throw new Error('Thread not found. Please start a conversation first.');
    }

    // Use LangGraph streaming with full state values after each step
    return this.compiledGraph.stream(currentState, {
      streamMode: 'values',
      configurable: { thread_id: threadId }
    });
  }

  /**
   * Initialize thread state for a new conversation
   */
  createInitialState(threadId: string, userQuery: string, messages: any[] = []): State {
    return {
      messages,

      threadId,
      uiPhase: UiPhase.Chatting,
      interrupt: undefined,
      
      userQuery,
      intent: null,
      
      userEscalated: false,
      userKey: threadId,
      userChoice: undefined,
      
      preferredDate: '',
      preferredProvider: '',
      availableSlots: [],
      selectedSlotId: '',
      eventId: '',
      
      retrievedDocs: [],
      validatedAswer: '',
      
      availableTimesDoNotWork: false,
      twoWeekCapExceeded: false,
      escalationNeeded: false
    } as State;
  }

  /**
   * Check if the graph is ready to be used
   */
  isReady(): boolean {
    return this.compiledGraph !== null;
  }
}

/**
 * Factory function to create GraphService with compiled graph
 */
export function createGraphService(compiledGraph: any): GraphService {
  return new GraphService(compiledGraph);
}
