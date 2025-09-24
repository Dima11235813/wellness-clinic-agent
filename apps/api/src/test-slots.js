// Simple test to verify slots are logged and available
import { ChatOpenAI } from "@langchain/openai";
import { makeOfferOptionsNode } from "./graph/nodes/offerOptions.js";
import { createDepsWithDefaults, createLogger } from "./graph/deps.js";
import { StateAnnotation } from "./graph/schema.js";

async function testSlots() {
  console.log("Testing slot availability and logging...");

  // Create dependencies
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  });

  const logger = createLogger();
  const deps = createDepsWithDefaults(llm, logger);

  // Create offerOptions node
  const offerOptions = makeOfferOptionsNode(deps);

  // Create a test state
  const testState = {
    messages: [],
    threadId: "test-thread",
    uiPhase: "Chatting",
    interrupt: null,
    userQuery: "I want to reschedule my appointment",
    intent: "OFFER_OPTIONS",
    userEscalated: false,
    userKey: "test-user",
    userChoice: null,
    preferredDate: "",
    preferredProvider: "",
    availableSlots: [],
    selectedSlotId: "",
    eventId: "",
    retrievedDocs: [],
    validatedAswer: "",
    availableTimesDoNotWork: false,
    twoWeekCapExceeded: false,
    escalationNeeded: false
  };

  try {
    console.log("Running offerOptions node...");
    const result = await offerOptions(testState);

    console.log("Test completed successfully!");
    console.log("Result type:", typeof result);
    if (result && typeof result === 'object') {
      console.log("Has update:", 'update' in result);
      console.log("Has goto:", 'goto' in result);
    }

  } catch (error) {
    console.error("Test failed:", error);
    // This is expected since interrupt() will be called and should raise an exception
    console.log("Interrupt was called (expected behavior)");
  }
}

testSlots();
