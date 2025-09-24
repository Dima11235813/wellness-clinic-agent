import { EmbeddingService } from '../utils/embeddings.js';
import { RetrievalService } from '../services/retrieval.js';

/**
 * Simple test for vector inspection without requiring API keys
 */
async function simpleVectorTest(): Promise<void> {
  console.log('🧪 Simple Vector Database Test...\n');

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is required');
      return;
    }

    const embeddingService = new EmbeddingService(apiKey);
    const retrievalService = new RetrievalService(embeddingService);

    // Check if we have any data
    const stats = await retrievalService.getStats();
    console.log('📊 Vector Store Stats:', stats);

    if (stats.totalChunks === 0) {
      console.log('ℹ️  No data in vector store - run ingestion first');
      return;
    }

    // Test inspection
    console.log('\n🔍 Inspecting vector store...');
    const inspection = await retrievalService.inspect(2, false);
    console.log('✅ Found chunks:', inspection.sampleChunks.length);

    if (inspection.sampleChunks.length > 0) {
      console.log('📄 Sample chunk:');
      console.log('   ID:', inspection.sampleChunks[0].id);
      console.log('   Page:', inspection.sampleChunks[0].metadata.pageNumber);
      console.log('   Content preview:', inspection.sampleChunks[0].content.substring(0, 150) + '...');
    }

    // Test text search (doesn't require embeddings)
    console.log('\n🔎 Testing text search...');
    const textResults = await retrievalService.searchByText('policy', 2);
    console.log('✅ Text search found:', textResults.results.length, 'matches');

    console.log('\n🎉 Basic vector inspection tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleVectorTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
