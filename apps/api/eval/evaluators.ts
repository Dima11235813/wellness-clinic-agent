import { createTrajectoryMatchEvaluator, createTrajectoryLLMAsJudge, TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE } from "agentevals";

/**
 * Evaluator for checking if agent trajectories match expected patterns
 * Uses superset mode to allow additional tool calls beyond the reference
 */
const baseTrajectoryEvaluator = createTrajectoryMatchEvaluator({
    trajectoryMatchMode: "superset",
});

/**
 * Wrapper to adapt trajectory evaluator to LangSmith's snake_case convention
 */
export const trajectoryEvaluator = async (run: any) => {
    // Convert snake_case to camelCase for agentevals compatibility
    return baseTrajectoryEvaluator({
        inputs: run.inputs,
        outputs: run.outputs, // Cast to expected type
        referenceOutputs: run.reference_outputs, // Cast to expected type
    });
};

/**
 * LLM-as-judge evaluator for trajectory accuracy
 * Uses a predefined prompt that compares agent trajectories against reference outputs
 */
const baseTrajectoryLLMEvaluator = createTrajectoryLLMAsJudge({
    prompt: TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE,
    model: "openai:gpt-4o-mini", // Using gpt-4o-mini for cost efficiency
});

/**
 * Wrapper to adapt LLM trajectory evaluator to LangSmith's snake_case convention
 */
export const trajectoryLLMEvaluator = async (run: any) => {
    // Convert snake_case to camelCase for agentevals compatibility
    return baseTrajectoryLLMEvaluator({
        inputs: run.inputs,
        outputs: run.outputs, // Cast to expected type
        referenceOutputs: run.reference_outputs, // Cast to expected type
    });
};

/**
 * Custom evaluator for policy response accuracy
 * Compares the final assistant message against expected policy answers
 */
export const policyResponseEvaluator = async (run: any) => {
    const outputMessages = run.outputs.messages;
    const referenceMessages = run.reference_outputs?.messages;

    if (!outputMessages || !referenceMessages) {
        return {
            key: "policy_response_accuracy",
            score: 0,
            comment: "Missing output or reference messages",
        };
    }

    // Get the last assistant message from outputs
    const lastAssistantMessage = [...outputMessages]
        .reverse()
        .find((msg: any) => msg._getType() === "ai");

    // Get the expected assistant message from reference
    const expectedMessage = referenceMessages.find((msg: any) => msg._getType() === "ai");

    if (!lastAssistantMessage || !expectedMessage) {
        return {
            key: "policy_response_accuracy",
            score: 0,
            comment: "No assistant message found in outputs or reference",
        };
    }

    const actualContent = lastAssistantMessage.content;
    const expectedContent = expectedMessage.content;

    // Simple string similarity check (could be enhanced with semantic similarity)
    const similarity = calculateStringSimilarity(
        actualContent.toLowerCase(),
        expectedContent.toLowerCase()
    );

    return {
        key: "policy_response_accuracy",
        score: similarity,
        comment: `Similarity: ${similarity.toFixed(2)}`,
    };
};

/**
 * Evaluator for checking if policy context was properly used
 * This checks if the agent used retrieval tools when contextPolicyRequired is true
 */
export const contextUsageEvaluator = async (run: any) => {
    const outputMessages = run.outputs.messages;

    // Check if any tool calls were made for retrieval (this is a simplified check)
    const hasRetrievalCalls = outputMessages.some((msg: any) => {
        if (msg._getType() === "ai" && "tool_calls" in msg) {
            const toolCalls = msg.tool_calls || [];
            return toolCalls.some((call: any) =>
                call.function?.name?.includes("retrieve") ||
                call.function?.name?.includes("search") ||
                call.function?.name?.includes("rag")
            );
        }
        return false;
    });

    // For policy questions that require context, we expect retrieval calls
    // This is a simplified heuristic - in practice you'd want more sophisticated logic
    const score = hasRetrievalCalls ? 1 : 0;

    return {
        key: "context_usage",
        score,
        comment: hasRetrievalCalls
            ? "Agent used retrieval tools appropriately"
            : "Agent may not have used retrieval tools when needed",
    };
};

/**
 * Simple string similarity calculation
 * Uses Levenshtein distance normalized by string length
 */
function calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}
