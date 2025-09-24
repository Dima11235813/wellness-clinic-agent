import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Tools } from "./tools.js";
import { EmbeddingService } from "../utils/embeddings.js";
import { RetrievalService } from "../services/retrieval.js";

export interface Logger {
  debug: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
}

export interface Deps {
  llm: BaseChatModel; // e.g., new ChatOpenAI({ model: "gpt-4o-mini" })
  logger: Logger; // console or pino/winston wrapper
  tools: Tools;
  embeddingService: EmbeddingService;
  retrievalService: RetrievalService;
  // Optional future deps:
  // tracer: LangSmithTracer;
}

export function createLogger(): Logger {
  return {
    debug: (message: string, meta?: Record<string, any>) => {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    info: (message: string, meta?: Record<string, any>) => {
      console.info(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    warn: (message: string, meta?: Record<string, any>) => {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    error: (message: string, meta?: Record<string, any>) => {
      console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
  };
}

