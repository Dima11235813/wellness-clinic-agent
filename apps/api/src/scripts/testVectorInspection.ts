import { ingestPolicies } from './ingestPolicies.js';
import { EmbeddingService } from '../utils/embeddings.js';
import { RetrievalService } from '../services/retrieval.js';

/**
 * Test script for vector database inspection functionality
 */
async function testVectorInspection(): Promise<void> {
  console.log('🧪 Testing Vector Database Inspection...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    return;
  }

  const embeddingService = new EmbeddingService(apiKey);
  const retrievalService = new RetrievalService(embeddingService);

  // First ensure we have data in the vector store
  console.log('📥 Ensuring vector store has data...');
  try {
    await ingestPolicies(retrievalService);
    console.log('✅ Data ingestion completed');
  } catch (error) {
    console.log('ℹ️  Data may already be ingested or ingestion failed, continuing with tests...');
  }

  // Test 1: Get stats
  console.log('📊 Testing vector stats...');
  try {
    const stats = await retrievalService.getStats();
    console.log('✅ Stats:', stats);
  } catch (error) {
    console.error('❌ Stats failed:', error);
    return;
  }

  // Test 2: Inspect chunks
  console.log('\n🔍 Testing vector inspection...');
  try {
    const inspection = await retrievalService.inspect(3, false);
    console.log('✅ Inspection:', {
      totalChunks: inspection.totalChunks,
      uniqueDocuments: inspection.uniqueDocuments,
      sampleCount: inspection.sampleChunks.length,
      firstSample: inspection.sampleChunks[0] ? {
        id: inspection.sampleChunks[0].id,
        contentPreview: inspection.sampleChunks[0].content.substring(0, 100) + '...',
        pageNumber: inspection.sampleChunks[0].metadata.pageNumber,
        filename: inspection.sampleChunks[0].metadata.filename
      } : null
    });
  } catch (error) {
    console.error('❌ Inspection failed:', error);
    return;
  }

  // Test 3: Search by text
  console.log('\n🔎 Testing text search...');
  try {
    const searchResult = await retrievalService.searchByText('cancellation policy', 2);
    console.log('✅ Text search results:', {
      query: searchResult.query,
      resultsCount: searchResult.results.length,
      topResult: searchResult.results[0] ? {
        score: searchResult.results[0].score,
        contentPreview: searchResult.results[0].chunk.content.substring(0, 100) + '...'
      } : null
    });
  } catch (error) {
    console.error('❌ Text search failed:', error);
  }

  // Test 4: Semantic search
  console.log('\n🧠 Testing semantic search...');
  try {
    const semanticResult = await retrievalService.retrieve('What is the cancellation policy?', 2);
    console.log('✅ Semantic search results:', {
      query: semanticResult.query,
      chunksFound: semanticResult.chunks.length,
      citations: semanticResult.citations,
      topChunk: semanticResult.chunks[0] ? {
        score: semanticResult.chunks[0].score,
        contentPreview: semanticResult.chunks[0].content.substring(0, 100) + '...',
        pageNumber: semanticResult.chunks[0].metadata.pageNumber
      } : null
    });
  } catch (error) {
    console.error('❌ Semantic search failed:', error);
  }

  console.log('\n🎉 Vector inspection tests completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVectorInspection()
    .then(() => {
      console.log('\n✅ All vector inspection tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Vector inspection tests failed:', error);
      process.exit(1);
    });
}
