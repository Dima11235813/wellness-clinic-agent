import { NodeName } from "@wellness/dto";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Structured output schema for intent inference
export const IntentInferenceSchema = z.object({
  intent: z.string(), // Can be NodeName.POLICY_QUESTION, NodeName.OFFER_OPTIONS_AGENT, or "unknown"
  confidence: z.number(),
  reason: z.string()
});

export type IntentInferenceResult = z.infer<typeof IntentInferenceSchema>;

// Create the structured output parser
export const IntentParser = StructuredOutputParser.fromZodSchema(IntentInferenceSchema as any);

// System prompt for intent classification
export const INTENT_SYSTEM_PROMPT = `You are an intent classification assistant for a wellness clinic chatbot. Your task is to analyze user messages and classify their intent into one of two categories.

Rules for classification:
- "${NodeName.POLICY_QUESTION}": Questions about policies, rules, procedures, what's allowed, cancellation policies, membership rules, facility rules, equipment usage, membership benefits, facility access, rules and regulations, etc.
- "${NodeName.OFFER_OPTIONS_AGENT}": Messages about changing, canceling, booking, scheduling, or rescheduling appointments, making new appointments, modifying existing appointments, etc.

Always respond with valid JSON that matches the required schema. If you're not confident (confidence < 0.6), set the intent to "unknown".`;

// Structured prompt template with format instructions slot
export const IntentClassifierPrompt = ChatPromptTemplate.fromMessages([
  ["system", INTENT_SYSTEM_PROMPT],
  [
    "human",
    [
      "Analyze the following user message and classify their intent.",
      "",
      "User message: \"{userQuery}\"",
      "",
      "{formatInstructions}"
    ].join("\n")
  ]
]);
