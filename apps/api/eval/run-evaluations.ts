import { evaluate } from "langsmith/evaluation";
import { Client } from "langsmith";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
import { trajectoryEvaluator, trajectoryLLMEvaluator, policyResponseEvaluator, contextUsageEvaluator } from "./evaluators.js";
import { getCompiledGraph } from "../src/graph/app.js";
import { EmbeddingService } from "../src/utils/embeddings.js";
import { RetrievalService } from "../src/services/retrieval.js";

// Load .env file from the same location as the main app
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// For compiled JS, look in the parent directory
const isCompiled = __dirname.includes('dist');
const envPath = isCompiled ? path.join(__dirname, '../../.env') : path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

/**
 * Main evaluation runner for the Wellness Clinic Agent
 * Runs multiple evaluators against the LangSmith dataset
 */
async function runEvaluations() {
    console.log("🚀 Starting Wellness Clinic Agent Evaluations");

    // Check environment variables first
    console.log("🔧 Checking environment variables...");
    console.log(`   LANGCHAIN_API_KEY: ${process.env.LANGCHAIN_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT || 'default'}`);

    try {
        // Load the dataset (handle both source and compiled locations)
        const isCompiled = __dirname.includes('dist');
        const datasetDir = isCompiled ? path.join(__dirname, '../..', 'eval') : __dirname;
        const datasetPath = path.join(datasetDir, "clinic-policy-evals.json");
        const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
        console.log(`📊 Loaded dataset with ${dataset.length} examples`);

        // Initialize services (similar to main app)
        console.log("🔧 Initializing services...");
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is required for evaluations");
        }

        console.log("   📚 Setting up embedding service...");
        const embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);

        console.log("   🔍 Setting up retrieval service...");
        const retrievalService = new RetrievalService(embeddingService);

        // Initialize the agent
        console.log("🤖 Initializing agent...");
        const agent = getCompiledGraph(embeddingService, retrievalService);
        console.log("✅ Agent initialized successfully");

        // Convert dataset to LangSmith format
        const langsmithDataset = dataset.map((item: any, index: number) => ({
            inputs: item.input,
            outputs: item.output,
            reference_outputs: item.output, // Use expected output as reference
            metadata: {
                contextPolicyRequired: item.contextPolicyRequired,
                example_index: index,
            },
        }));

        // Create or update dataset in LangSmith
        const client = new Client();
        const datasetName = "wellness-clinic-policy-evals";
        try {
            console.log(`📤 Creating/updating dataset "${datasetName}" in LangSmith...`);

            // Check if dataset exists
            let existingDataset;
            try {
                existingDataset = await client.readDataset({ datasetName });
                console.log(`📋 Dataset "${datasetName}" exists, updating...`);
            } catch {
                console.log(`📋 Dataset "${datasetName}" doesn't exist, creating...`);
            }

            // Create or update the dataset with examples
            if (!existingDataset) {
                await client.createDataset(datasetName, {
                    description: "Wellness Clinic Agent policy and scheduling evaluation dataset",
                });
            }

            // Add examples to the dataset
            for (const example of langsmithDataset) {
                await client.createExample({
                    dataset_name: datasetName,
                    inputs: example.inputs,
                    outputs: example.outputs,
                    metadata: example.metadata,
                });
            }

            console.log(`✅ Dataset "${datasetName}" ready in LangSmith`);
        } catch (error) {
            console.warn(`⚠️  Could not create/update LangSmith dataset:`, error);
            console.log(`💡 Continuing with local evaluation only...`);
        }

        // Define evaluation configurations
        const evaluationConfigs = [
            {
                name: "trajectory-match",
                evaluators: [trajectoryEvaluator],
                description: "Checks if agent follows expected tool call patterns",
            },
            {
                name: "trajectory-llm-judge",
                evaluators: [trajectoryLLMEvaluator],
                description: "LLM-based evaluation of trajectory accuracy",
            },
            {
                name: "policy-response-accuracy",
                evaluators: [policyResponseEvaluator],
                description: "Evaluates accuracy of policy responses",
            },
            {
                name: "context-usage",
                evaluators: [contextUsageEvaluator],
                description: "Checks if agent properly uses context/retrieval when needed",
            },
            {
                name: "comprehensive",
                evaluators: [
                    trajectoryEvaluator,
                    policyResponseEvaluator,
                    contextUsageEvaluator,
                ],
                description: "Comprehensive evaluation with multiple metrics",
            },
        ];

        console.log(`\n📋 Will run ${evaluationConfigs.length} evaluation configurations:`);
        evaluationConfigs.forEach((config, index) => {
            console.log(`   ${index + 1}. ${config.name}: ${config.description}`);
        });

        // Run evaluations
        for (const config of evaluationConfigs) {
            console.log(`\n🔍 Running ${config.name} evaluation...`);
            console.log(`Description: ${config.description}`);

            try {
                console.log(`   📊 Running evaluation on ${dataset.length} examples...`);
                const results = await evaluate(async (inputs: any) => {
                    console.log(`     🤖 Invoking agent for: "${inputs.messages?.[0]?.content?.substring(0, 50)}..."`);

                    // Add thread ID for proper state management
                    const threadId = `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const result = await agent.invoke({
                        ...inputs,
                        threadId,
                        uiPhase: "chat", // Set appropriate initial UI phase
                    }, {
                        configurable: {
                            thread_id: threadId,
                        },
                    });

                    console.log(`     ✅ Agent completed for thread ${threadId.substring(0, 10)}...`);
                    return result;
                }, {
                    data: datasetName,
                    evaluators: config.evaluators,
                    experimentPrefix: `wellness-agent-${config.name}`,
                    maxConcurrency: 3, // Limit concurrency to avoid rate limits
                });

                console.log(`✅ ${config.name} evaluation completed`);
                console.log(`Results saved to LangSmith with experiment prefix: wellness-agent-${config.name}`);
            } catch (error) {
                console.error(`❌ Error running ${config.name} evaluation:`, error);
            }
        }

        console.log("\n🎉 All evaluations completed successfully!");
        console.log("📈 Check LangSmith for detailed results and metrics");
        console.log("🔍 Look for datasets named 'wellness-clinic-policy-evals'");
        console.log("📊 Experiments will be prefixed with 'wellness-agent-'");
    } catch (error) {
        console.error("💥 Error during evaluation setup:", error);
        console.error("💡 Check that:");
        console.error("   - LANGCHAIN_API_KEY and OPENAI_API_KEY are set");
        console.error("   - The API server is running (npm start)");
        console.error("   - Network connectivity to LangSmith and OpenAI");
        process.exit(1);
    }
}

/**
 * Utility function to create a simple trajectory reference for testing
 * This can be used to generate reference trajectories for the dataset
 */
export function createReferenceTrajectory(toolCalls: any[]) {
    return [
        {
            role: "assistant",
            tool_calls: toolCalls.map((call) => ({
                function: {
                    name: call.name,
                    arguments: JSON.stringify(call.arguments),
                },
            })),
        },
    ];
}

/**
 * Run trajectory evaluation only
 */
export async function runTrajectoryEval() {
    await runSpecificEvaluation("trajectory-match", [trajectoryEvaluator]);
}

/**
 * Run policy response evaluation only
 */
export async function runPolicyEval() {
    await runSpecificEvaluation("policy-response-accuracy", [policyResponseEvaluator]);
}

/**
 * Run context usage evaluation only
 */
export async function runContextEval() {
    await runSpecificEvaluation("context-usage", [contextUsageEvaluator]);
}

/**
 * Run comprehensive evaluation with all metrics
 */
export async function runComprehensiveEval() {
    await runSpecificEvaluation("comprehensive", [
        trajectoryEvaluator,
        policyResponseEvaluator,
        contextUsageEvaluator,
    ]);
}

/**
 * Helper function to run a specific evaluation configuration
 */
async function runSpecificEvaluation(name: string, evaluators: any[], description?: string) {
    console.log(`🔍 Running ${name} evaluation...`);
    if (description) console.log(`Description: ${description}`);

    try {
        // Load the dataset (handle both source and compiled locations)
        const isCompiled = __dirname.includes('dist');
        const datasetDir = isCompiled ? path.join(__dirname, '../..', 'eval') : __dirname;
        const datasetPath = path.join(datasetDir, "clinic-policy-evals.json");
        const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

        // Initialize the agent (similar to main app)
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is required for evaluations");
        }

        const embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
        const retrievalService = new RetrievalService(embeddingService);
        const agent = getCompiledGraph(embeddingService, retrievalService);

        // Convert dataset to LangSmith format
        const langsmithDataset = dataset.map((item: any, index: number) => ({
            inputs: item.input,
            outputs: item.output,
            reference_outputs: item.output, // Use expected output as reference
            metadata: {
                contextPolicyRequired: item.contextPolicyRequired,
                example_index: index,
            },
        }));

        // Create or update dataset in LangSmith
        const client = new Client();
        const datasetName = "wellness-clinic-policy-evals";
        try {
            console.log(`📤 Creating/updating dataset "${datasetName}" in LangSmith...`);

            // Check if dataset exists
            let existingDataset;
            try {
                existingDataset = await client.readDataset({ datasetName });
                console.log(`📋 Dataset "${datasetName}" exists, updating...`);
            } catch {
                console.log(`📋 Dataset "${datasetName}" doesn't exist, creating...`);
            }

            // Create or update the dataset with examples
            if (!existingDataset) {
                await client.createDataset(datasetName, {
                    description: "Wellness Clinic Agent policy and scheduling evaluation dataset",
                });
            }

            // Add examples to the dataset
            for (const example of langsmithDataset) {
                await client.createExample({
                    dataset_name: datasetName,
                    inputs: example.inputs,
                    outputs: example.outputs,
                    metadata: example.metadata,
                });
            }

            console.log(`✅ Dataset "${datasetName}" ready in LangSmith`);
        } catch (error) {
            console.warn(`⚠️  Could not create/update LangSmith dataset:`, error);
            console.log(`💡 Continuing with local evaluation only...`);
        }

        const results = await evaluate(async (inputs: any) => {
            const threadId = `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const result = await agent.invoke({
                ...inputs,
                threadId,
                uiPhase: "chat",
            }, {
                configurable: {
                    thread_id: threadId,
                },
            });
            return result;
        }, {
            data: datasetName,
            evaluators,
            experimentPrefix: `wellness-agent-${name}`,
            maxConcurrency: 3,
        });

        console.log(`✅ ${name} evaluation completed successfully`);
        console.log(`📊 Results saved to LangSmith with experiment prefix: wellness-agent-${name}`);
    } catch (error) {
        console.error(`❌ Error running ${name} evaluation:`, error);
        throw error;
    }
}

/**
 * Test basic setup without running full evaluations
 */
export async function testSetup() {
    console.log("🧪 Testing evaluation setup...");

    try {
        // Check environment variables
        console.log("🔧 Checking environment variables...");
        console.log(`   LANGCHAIN_API_KEY: ${process.env.LANGCHAIN_API_KEY ? '✅ Set' : '❌ Missing'}`);
        console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
        console.log(`   LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT || 'default'}`);

        // Load dataset (handle both source and compiled locations)
        const isCompiled = __dirname.includes('dist');
        const datasetDir = isCompiled ? path.join(__dirname, '../..', 'eval') : __dirname;
        const datasetPath = path.join(datasetDir, "clinic-policy-evals.json");
        const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
        console.log(`📊 Dataset loaded: ${dataset.length} examples`);

        // Test LangSmith connection
        console.log("🔗 Testing LangSmith connection...");
        const client = new Client();
        try {
            await client.listDatasets({ limit: 1 });
            console.log("✅ LangSmith connection successful");
        } catch (error: any) {
            console.log("❌ LangSmith connection failed:", error.message);
        }

        // Test agent initialization
        console.log("🤖 Testing agent initialization...");
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY required");
        }

        const embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY);
        const retrievalService = new RetrievalService(embeddingService);
        const agent = getCompiledGraph(embeddingService, retrievalService);
        console.log("✅ Agent initialized successfully");

        // Test single agent invocation
        console.log("🧪 Testing single agent invocation...");
        const testInput = dataset[0]; // Use first example
        const threadId = `test-${Date.now()}`;
        const result = await agent.invoke({
            ...testInput.input,
            threadId,
            uiPhase: "chat",
        }, {
            configurable: {
                thread_id: threadId,
            },
        });

        console.log("✅ Agent invocation successful");
        console.log(`📝 Response: "${(result as any).messages[(result as any).messages.length - 1]?.content?.substring(0, 100)}..."`);

        console.log("\n🎉 Setup test completed successfully!");
        console.log("💡 If this works, try running: npm run eval:all");
    } catch (error) {
        console.error("❌ Setup test failed:", error);
        console.error("💡 Check your environment variables and API keys");
        process.exit(1);
    }
}

// Run evaluations if this script is executed directly
const normalizedImportUrl = import.meta.url.replace(/^file:\/\/\//, '').replace(/\\/g, '/');
const normalizedArgv1 = process.argv[1].replace(/\\/g, '/');
if (normalizedImportUrl === normalizedArgv1) {
    runEvaluations().catch(console.error);
}
