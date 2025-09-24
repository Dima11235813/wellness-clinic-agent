import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chatRouter, threadStore } from './http/chat.js';
import { resumeRouter } from './http/resume.js';
import { EmbeddingService } from './utils/embeddings.js';
import { RetrievalService } from './services/retrieval.js';

// Resolve .env relative to this file so local runs and workspaces behave the same
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

let compiledGraph: any = null;
let embeddingService: EmbeddingService | null = null;
let retrievalService: RetrievalService | null = null;

try {
  // Only attempt to initialize services if an API key is present
  if (process.env.OPENAI_API_KEY) {
    console.log('[api] Initializing embedding and retrieval services...');
    embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
    retrievalService = new RetrievalService(embeddingService);

    const { getCompiledGraph } = await import('./graph/app.js');
    compiledGraph = getCompiledGraph(embeddingService, retrievalService);
  } else {
    console.warn('[api] OPENAI_API_KEY not set. Graph will be disabled; serving static UI only.');
  }
} catch (err) {
  console.warn('[api] Failed to initialize LangGraph. Serving static UI only.', err);
}

// Initialize RAG knowledge base on startup
try {
  const { ingestPolicies } = await import('./scripts/ingestPolicies.js');
  console.log('[api] Initializing RAG knowledge base...');

  if (process.env.OPENAI_API_KEY && retrievalService) {
    await ingestPolicies(retrievalService);
    console.log('[api] RAG knowledge base initialized successfully');
    console.log(`[api] Retrieval service has data`);
  } else {
    console.log('[api] Skipping RAG initialization - OpenAI API key not configured');
    console.log('[api] Policy questions will fall back to static responses');
  }
} catch (err) {
  console.warn('[api] Failed to initialize RAG knowledge base:', err);
}

// __filename/__dirname already defined above for dotenv resolution

const app = express();
app.use(cors());
app.use(express.json());

// Use the compiled graph from the new LangGraph architecture
const graph = compiledGraph;
if (graph) {
  console.log('[api] LangGraph initialized successfully');
}

// Serve static files from Angular build
const angularDistPath = path.join(__dirname, '../../web/dist/web/browser');
app.use(express.static(angularDistPath));

// API routes
app.get('/health', async (_req, res) => {
  console.log(`[health] retrievalService is ${retrievalService ? 'not null' : 'null'}`);
  if (retrievalService) {
    const stats = await retrievalService.getStats();
    console.log(`[health] retrievalService has ${stats.totalChunks} chunks`);
  }
  res.json({
    ok: true,
    graphReady: !!compiledGraph,
    ragReady: retrievalService !== null
  });
});

// Vector database inspection endpoints
app.get('/api/vector/stats', async (_req, res) => {
  try {
    if (!retrievalService) {
      return res.status(503).json({ error: 'Vector database not ready' });
    }
    const stats = await retrievalService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Vector stats error:', error);
    res.status(500).json({ error: 'Failed to get vector stats' });
  }
});

app.get('/api/vector/inspect', async (req, res) => {
  try {
    if (!retrievalService) {
      return res.status(503).json({ error: 'Vector database not ready' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const includeEmbeddings = req.query.embeddings === 'true';

    const inspection = await retrievalService.inspect(limit, includeEmbeddings);
    res.json(inspection);
  } catch (error) {
    console.error('Vector inspection error:', error);
    res.status(500).json({ error: 'Failed to inspect vector database' });
  }
});

app.get('/api/vector/search', async (req, res) => {
  try {
    if (!retrievalService) {
      return res.status(503).json({ error: 'Vector database not ready' });
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const searchType = req.query.type as string || 'semantic';

    let results;
    if (searchType === 'text') {
      results = await retrievalService.searchByText(query, limit);
    } else {
      const retrievalResult = await retrievalService.retrieve(query, limit);
      results = {
        query: retrievalResult.query,
        results: retrievalResult.chunks.map((chunk: any, index: number) => ({
          chunk: {
            id: chunk.metadata.docHash + '_' + chunk.metadata.chunkIndex,
            content: chunk.content,
            metadata: chunk.metadata,
          },
          score: chunk.score,
        })),
      };
    }

    res.json(results);
  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({ error: 'Failed to search vector database' });
  }
});

// Legacy routes (for compatibility)
app.get('/chat/messages', (_req, res) => {
  const messages = [
    {
      id: '1',
      role: 'assistant',
      text: 'Hello! How can I help you today?',
      at: new Date().toISOString()
    }
  ];
  res.json(messages);
});

app.get('/chat/ui-phase', (_req, res) => {
  res.json({ phase: 'Chatting' });
});

// Use the separate routers
app.use('/api', chatRouter);
app.use('/api', resumeRouter);

// Streaming endpoint
app.get('/api/stream', async (req, res) => {
  const { threadId } = req.query;

  if (!compiledGraph) {
    return res.status(503).json({ error: 'Graph not ready' });
  }

  if (!threadId || typeof threadId !== 'string') {
    return res.status(400).json({ error: 'threadId parameter required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Flush headers early to reduce buffering in some proxies/browsers
  try { (res as any).flushHeaders?.(); } catch {}

  let keepAlive: NodeJS.Timeout | null = null;
  try {
    console.log(`[stream] Starting graph execution for thread ${threadId}`);

    // Get current state from the threadStore (set during /chat and /resume)
    const currentState = threadStore.get(threadId);
    if (!currentState) {
      return res.status(404).json({ error: 'Thread not found. Please start a conversation first.' });
    }

    // Stream complete state updates - messages will be updated progressively
    const stream = await compiledGraph.stream(currentState, {
      streamMode: 'values',
      configurable: { thread_id: threadId }
    });

    // Periodic keepalive to keep the connection open
    keepAlive = setInterval(() => {
      try { res.write(`:\n\n`); } catch {}
    }, 15000);

    for await (const stateChunk of stream) {
      // Persist the latest state so future requests resume correctly
      try { threadStore.set(threadId, stateChunk); } catch {}

      const eventData = {
        type: 'state',
        data: {
          messages: (stateChunk as any).messages,
          uiPhase: (stateChunk as any).uiPhase,
          interrupt: (stateChunk as any).interrupt,
          threadId: threadId,
          availableSlots: (stateChunk as any).availableSlots
        }
      };
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);

      // If node raised an interrupt, surface it immediately
      if ((stateChunk as any).interrupt) {
        const interruptData = { type: 'interrupt', data: (stateChunk as any).interrupt };
        res.write(`data: ${JSON.stringify(interruptData)}\n\n`);
      }
    }

    // Send completion once stream ends
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

  } catch (error) {
    console.error('[api] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
  } finally {
    try { if (keepAlive) clearInterval(keepAlive); } catch {}
    res.end();
  }
});

// Catch all handler: send back Angular's index.html file for client-side routing
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
