import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
import { loadConfig } from "./config.js";

export class Models {
  llmModel: ChatOpenAI<ChatOpenAICallOptions>;

  constructor() {
    const cfg = loadConfig();
    this.llmModel = new ChatOpenAI({
      model: cfg.MODEL,
      apiKey: cfg.OPENAI_API_KEY,
      timeout: cfg.TIMEOUT_MS,
    });
  }

  testModel() {
    return this.llmModel;
  }
}

export function createLlm() {
  const cfg = loadConfig();
  if (!cfg.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new ChatOpenAI({
    apiKey: cfg.OPENAI_API_KEY,
    model: cfg.MODEL,
    timeout: cfg.TIMEOUT_MS,
  });
}
