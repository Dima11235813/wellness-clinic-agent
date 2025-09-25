import { buildGraph } from "./buildGraph.js";
import { createLogger, Deps } from "./deps.js";
import { createLlm } from "./llm.js";
import { MemorySaver } from "@langchain/langgraph";
import { EmbeddingService } from "../utils/embeddings.js";
import { RetrievalService } from "../services/retrieval.js";

/**
 * Initialize application dependencies
 */
export function createDeps(embeddingService: EmbeddingService, retrievalService: RetrievalService) {
  const llm = createLlm();
  const logger = createLogger();
  const tools = {
    availabilityTool: {
      getAvailability: async (args: any) => {
        // Import dynamically to avoid circular dependency
        const { availabilityTool } = await import('./tools/availability.js');
        return await availabilityTool.invoke(args);
      },
    },
    escalationTool: {
      escalateToSlack: async (args: any) => {
        const { escalationTool } = await import('./tools/escalation.js');
        return await escalationTool.invoke(args);
      },
    },
    policySearchTool: {
      searchPolicies: async (args: any) => {
        // We'll update this to use the retrieval service from deps
        return await searchPoliciesImpl(retrievalService, args);
      },
    },
    intentInferenceTool: {
      invoke: async (args: any) => {
        const { intentInferenceTool } = await import('./tools/intentInference.js');
        return await intentInferenceTool.invoke(args);
      },
    },
    rescheduleTool: {
      rescheduleAppointment: async (args: any) => {
        const { rescheduleTool } = await import('./tools/reschedule.js');
        return await rescheduleTool.invoke(args);
      },
    },
  };

  return { llm, logger, tools, embeddingService, retrievalService } as Deps;
}

// Helper function for policy search that uses the retrieval service from deps
async function searchPoliciesImpl(retrievalService: RetrievalService, { query, topK = 5 }: { query: string; topK?: number }) {
  const result = await retrievalService.retrieve(query, topK);

  const policyDocuments = result.chunks.map((chunk, index) => ({
    id: `${chunk.metadata.docHash}_${chunk.metadata.chunkIndex}`,
    content: chunk.content,
    metadata: {
      title: `Policy Section (Page ${chunk.metadata.pageNumber})`,
      source: chunk.metadata.filename,
      page: chunk.metadata.pageNumber,
    },
    score: chunk.score,
  }));

  console.log(`[CHROMA SEARCH] Query: "${query}" found ${policyDocuments.length} relevant policy documents`);

  return policyDocuments;
}

/**
 * Create and compile the LangGraph
 */
export function createCompiledGraph(embeddingService: EmbeddingService, retrievalService: RetrievalService) {
  const deps = createDeps(embeddingService, retrievalService);
  const builder = buildGraph(deps);

  // Compile the graph - this creates the executable LangGraph instance
  const checkpointer = new MemorySaver();
  const graph = builder.compile({ checkpointer });

  // Set a name for better observability
  graph.name = "WellnessClinicAgent";

  return graph;
}

// Export a function to get the compiled graph (lazy initialization)
let _compiledGraph: any = null;
export function getCompiledGraph(embeddingService?: EmbeddingService, retrievalService?: RetrievalService): any {
  if (!_compiledGraph) {
    if (!embeddingService || !retrievalService) {
      throw new Error('EmbeddingService and RetrievalService must be provided for graph initialization');
    }
    _compiledGraph = createCompiledGraph(embeddingService, retrievalService);
  }
  return _compiledGraph;
}

// Export a factory compatible with LangGraph Studio (expects a function returning a compiled graph)
export async function studio() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for studio mode');
  }

  console.log('[studio] Initializing embedding and retrieval services...');
  const embeddingService = new EmbeddingService(apiKey);
  const retrievalService = new RetrievalService(embeddingService);

  // Initialize RAG knowledge base
  const { ingestPolicies } = await import('../scripts/ingestPolicies.js');
  console.log('[studio] Initializing RAG knowledge base...');
  await ingestPolicies(retrievalService);
  console.log('[studio] RAG knowledge base initialized successfully');

  return getCompiledGraph(embeddingService, retrievalService);
}