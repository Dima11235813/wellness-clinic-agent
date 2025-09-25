import { State } from "../schema.js";
import { Deps } from "../deps.js";
import { UiPhase } from "@wellness/dto";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

export function makePolicyAnswerNode({ llm, logger, tools }: Deps) {
  return async function policyAnswerNode(state: State): Promise<Command> {
    logger.info("policyAnswerNode: Starting policy answer generation");

    if (!state.userQuery) {
      logger.warn("policyAnswerNode: No policy query found");
      return new Command({ update: {} });
    }

    try {
      // Use vector search tool to retrieve relevant policy documents (RAG implementation)
      logger.info("policyAnswerNode: Searching policy documents with vector search", {
        query: state.userQuery
      });

      const relevantDocs = await tools.policySearchTool.searchPolicies({
        query: state.userQuery,
        topK: 3
      });

      logger.info("policyAnswerNode: Retrieved policy documents", {
        documentCount: relevantDocs.length,
        documents: relevantDocs.map(doc => ({ id: doc.id, score: doc.score, title: doc.metadata.title }))
      });

      // Format retrieved documents for context
      const context = relevantDocs.length > 0
        ? relevantDocs.map(doc =>
            `Document: ${doc.metadata.title}\nContent: ${doc.content}\nRelevance Score: ${doc.score.toFixed(2)}`
          ).join('\n\n')
        : 'No relevant policy documents found.';

      // Use the LLM to answer the policy query with retrieved context
      const system = `You are a helpful assistant for a university wellness clinic. Answer policy-related questions using the provided context from our policy documents. Use concise, factual language. If the question cannot be answered from the context, say so and offer to connect them to a representative.

Context from policy documents:
${context}`;

      const messages = [
        new HumanMessage({ content: `${system}\n\nUser question: ${state.userQuery}` })
      ];

      logger.info("policyAnswerNode: Calling OpenAI model via LangChain with retrieved context");
      const ai = await llm.invoke(messages);

      const answerText = typeof ai.content === 'string'
        ? ai.content
        : Array.isArray(ai.content)
          ? ai.content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('\n')
          : '';

      if (!answerText) {
        logger.warn("policyAnswerNode: Model returned empty content");
        return new Command({ update: {
          userQuery: '',
        } });
      }

      const answerMessage = new AIMessage({
        content: answerText,
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });

      return new Command({
        update: {
          messages: [...state.messages, answerMessage],
          userQuery: '',
          uiPhase: UiPhase.PolicyQA
        }
      });

    } catch (error) {
      logger.error("policyAnswerNode: Failed to generate policy answer", {
        error: error instanceof Error ? error.message : String(error),
        query: state.userQuery
      });

      // Return error message
      const errorMessage = new AIMessage({
        content: "I'm sorry, I encountered an error while processing your policy question. Please try again or contact our support team.",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });

      return new Command({
        update: {
          messages: [...state.messages, errorMessage],
          uiPhase: UiPhase.Chatting,
          userQuery: '',
        }
      });
    }
  };
}