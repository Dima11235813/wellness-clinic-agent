import { ChatPromptTemplate } from "@langchain/core/prompts";

// Greeting prompt template that only shows on first interaction
export const GREETING_MESSAGE = "Hello! I'm here to help you with wellness clinic appointments and policy questions. Please tell me what you'd like help with.";

// Greeting prompt template (can be extended later if needed)
export const GreetingPrompt = ChatPromptTemplate.fromMessages([
  ["system", "Generate a friendly greeting message for a wellness clinic chatbot."],
  ["human", "Please provide a welcoming greeting for first-time users."]
]);
