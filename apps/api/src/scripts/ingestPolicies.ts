import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { IngestionService } from '../services/ingestion.js';
import { RetrievalService } from '../services/retrieval.js';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ingest policy documents into the vector store
 * This script runs on app startup to ensure the knowledge base is up to date
 */
export async function ingestPolicies(retrievalService: RetrievalService): Promise<void> {
  // Use absolute path to the PDF
  const policyPath = path.resolve(__dirname, '../../../..', 'data/policies/whp-participant-policy-manual-2025.pdf');
  console.log(`[ingestPolicies] Resolved policy path: ${policyPath}`);

  try {
    // Check if PDF exists
    await fs.access(policyPath);
    console.log(`Found policy manual at: ${policyPath}`);
  } catch (error) {
    console.warn(`Policy manual not found at: ${policyPath}. Skipping ingestion.`);
    return;
  }

  // Initialize ingestion service with provided retrieval service
  const ingestionService = new IngestionService(retrievalService);

  try {
    // Ingest the policy PDF
    const result = await ingestionService.ingestPolicyPDF(policyPath);

    console.log('Ingestion completed:', {
      documentHash: result.docHash,
      chunksProcessed: result.chunksProcessed,
      totalChunks: result.totalChunks,
      wasReingested: result.wasReingested,
    });

  } catch (error) {
    console.error('Failed to ingest policies:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // For standalone script execution, create services
  const { EmbeddingService } = await import('../utils/embeddings.js');
  const { RetrievalService } = await import('../services/retrieval.js');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const embeddingService = new EmbeddingService(apiKey);
  const retrievalService = new RetrievalService(embeddingService);

  ingestPolicies(retrievalService)
    .then(() => {
      console.log('Policy ingestion script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Policy ingestion script failed:', error);
      process.exit(1);
    });
}
