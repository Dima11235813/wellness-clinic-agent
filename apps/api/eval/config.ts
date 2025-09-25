/**
 * Configuration for Wellness Clinic Agent Evaluations
 */
export const EVALUATION_CONFIG = {
    // LangSmith settings
    langsmith: {
        project: "wellness-agent-evals",
        experimentPrefix: "wellness-agent",
        maxConcurrency: 3,
    },
    // Model settings for LLM-as-judge evaluators
    models: {
        judge: "openai:gpt-4o-mini", // Cost-effective model for evaluations
        fallback: "openai:gpt-3.5-turbo",
    },
    // Dataset settings
    dataset: {
        path: "./eval/clinic-policy-evals.json",
        format: "langsmith", // "langsmith" or "custom"
    },
    // Evaluation settings
    evaluations: {
        // Trajectory matching configuration
        trajectory: {
            mode: "superset", // "strict", "unordered", "subset", "superset"
            allowExtraCalls: true,
        },
        // Policy response evaluation
        policy: {
            similarityThreshold: 0.8, // Minimum similarity score for "correct"
            useSemanticSimilarity: false, // Use embedding-based similarity (future enhancement)
        },
        // Context usage evaluation
        context: {
            requiredForPolicyQuestions: true,
            toolCallPatterns: ["retrieve", "search", "rag", "vector"],
        },
    },
    // Output settings
    output: {
        saveResultsLocally: true,
        resultsPath: "./eval/results/",
        generateReport: true,
        reportFormat: "markdown", // "markdown", "json", "html"
    },
    // Debug settings
    debug: {
        enabled: process.env.DEBUG === "true",
        logLevel: "info", // "debug", "info", "warn", "error"
        saveIntermediateResults: false,
    },
};

/**
 * Validation rules for dataset entries
 */
export const DATASET_VALIDATION_RULES = {
    required: ["input", "output"],
    inputRequired: ["messages"],
    outputRequired: ["messages"],
    messageRequired: ["role", "content"],
    validRoles: ["user", "assistant", "system", "tool"],
    metadataOptional: ["contextPolicyRequired", "example_index"],
};
