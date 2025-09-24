import { NodeName } from "@wellness/dto";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Tool argument types
export interface InferIntentArgs {
  userQuery: string;
}

export interface IntentResult {
  intent: typeof NodeName.POLICY_QUESTION | typeof NodeName.OFFER_OPTIONS | 'unknown';
  confidence: number;
  reason: string;
}

// Lightweight intent detection without requiring the LLM inside the tool.
// The agent LLM decides when to call this tool.
function classifyHeuristic(userQuery: string): IntentResult {
  const text = userQuery.toLowerCase();
  const rescheduleHints = [
    'resched', 'reschedule', 'rescheduling', 'change my time', 'change appointment',
    'move appointment', 'available time', 'availability', 'slots', 'times', 'book', 'schedule',
    'confirm appointment', 'pick a time', 'select a time', 'find a time'
  ];

  const policyHints = [
    'policy', 'copay', 'co-pay', 'cancel', 'cancellation', 'no-show', 'missed', 'insurance',
    'coverage', 'benefit', 'rules', 'guideline', 'faq', 'question'
  ];

  const isReschedule = rescheduleHints.some(h => text.includes(h));
  const isPolicy = policyHints.some(h => text.includes(h));

  if (isReschedule && !isPolicy) {
    return { intent: NodeName.OFFER_OPTIONS, confidence: 0.75, reason: 'Matched scheduling-related keywords' };
  }
  if (isPolicy && !isReschedule) {
    return { intent: NodeName.POLICY_QUESTION, confidence: 0.7, reason: 'Matched policy-related keywords' };
  }
  // Ambiguous → default to policy to be safe
  return { intent: NodeName.POLICY_QUESTION, confidence: 0.5, reason: 'Ambiguous; defaulting to policy' };
}

// Define a real LangChain tool so ToolNode can execute it when the LLM calls it
export const getUserIntent = tool(
  async ({ userQuery }: InferIntentArgs): Promise<IntentResult> => {
    return classifyHeuristic(userQuery);
  },
  {
    name: "get_user_intent",
    description: "Classify a user's query as scheduling/rescheduling vs. policy question. Returns structured intent, confidence, and reason.",
    schema: z.object({
      userQuery: z.string().describe("The raw user input to classify."),
    }) as any,
  }
);

// Backward-compatible wrapper (not used by the ToolNode path). Kept for callers using direct invoke.
export const intentInferenceTool = {
  name: "infer_intent",
  description: "Classify intent (scheduling vs policy). Prefer using get_user_intent via ToolNode.",
  invoke: async ({ userQuery }: InferIntentArgs): Promise<IntentResult> => classifyHeuristic(userQuery),
};
