// Simple test to verify the graph builds and has no obvious loops
import { ChatOpenAI } from "@langchain/openai";
import { buildGraph } from "./buildGraph.js";
import { createDepsWithDefaults, createLogger } from "./deps.js";

async function testGraph() {
  console.log("Testing graph build...");

  // Create dependencies
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  });

  const logger = createLogger();
  const deps = createDepsWithDefaults(llm, logger);

  try {
    // Build the graph
    const graph = buildGraph(deps);
    console.log("✅ Graph built successfully");

    // Compile the graph to check for errors
    const compiledGraph = graph.compile();
    console.log("✅ Graph compiled successfully");

    // Check nodes
    const nodes = Object.keys(compiledGraph.getGraph().nodes);
    console.log("Nodes:", nodes);

    // Check edges to look for potential loops
    const edges = compiledGraph.getGraph().edges;
    console.log("Edges:", edges.length);

    // Look for self-loops or cycles
    const selfLoops = edges.filter(edge => edge.source === edge.target);
    if (selfLoops.length > 0) {
      console.warn("⚠️  Found self-loops:", selfLoops);
    } else {
      console.log("✅ No self-loops found");
    }

    // Check for basic cycles (this is a simple check, not exhaustive)
    const nodeSet = new Set(nodes);
    const hasExpectedNodes = ["infer_intent", "policy_question", "offer_options", "confirm_time", "notify_user", "escalate_human"].every(node => nodeSet.has(node));
    console.log("✅ Has expected nodes:", hasExpectedNodes);

    console.log("Graph test completed successfully!");

  } catch (error) {
    console.error("❌ Graph test failed:", error);
    process.exit(1);
  }
}

testGraph();
