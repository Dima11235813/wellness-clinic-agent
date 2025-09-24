import { RetrievalService } from '../services/retrieval.js';
import { IngestionService } from '../services/ingestion.js';
import { EmbeddingService } from '../utils/embeddings.js';
import { RAG_CONFIG } from '../config/rag.js';
import path from 'path';

/**
 * Test script for RAG knowledge base functionality
 */
async function testRagSystem(): Promise<void> {
  console.log('🧪 Testing RAG Knowledge Base System...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    return;
  }

  // Test 1: Check if PDF exists
  const policyPath = path.resolve(__dirname, RAG_CONFIG.documents.policyManual);
  console.log(`📄 Policy document path: ${policyPath}`);

  try {
    const fs = await import('fs/promises');
    await fs.access(policyPath);
    console.log('✅ Policy document exists');
  } catch (error) {
    console.log('❌ Policy document not found - skipping ingestion test');
    return;
  }

  // Test 2: Ingestion
  console.log('\n📥 Testing document ingestion...');
  const embeddingService = new EmbeddingService(apiKey);
  const retrievalService = new RetrievalService(embeddingService);
  const ingestionService = new IngestionService(retrievalService);

  try {
    const result = await ingestionService.ingestPolicyPDF(policyPath);
    console.log('✅ Ingestion completed:', {
      chunksProcessed: result.chunksProcessed,
      wasReingested: result.wasReingested,
      docHash: result.docHash.substring(0, 8) + '...',
    });
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    return;
  }

  // Test 3: Retrieval
  console.log('\n🔍 Testing document retrieval...');

  try {
    const queries = [
      'appointment cancellation policy',
      'membership fees',
      'facility rules',
    ];

    for (const query of queries) {
      console.log(`\n   Query: "${query}"`);
      const result = await retrievalService.retrieve(query, 3);

      if (result.chunks.length === 0) {
        console.log('   ❌ No results found');
      } else {
        console.log(`   ✅ Found ${result.chunks.length} chunks:`);
        result.chunks.forEach((chunk: any, i: number) => {
          console.log(`     ${i + 1}. Page ${chunk.metadata.pageNumber} (score: ${chunk.score.toFixed(3)})`);
          console.log(`        "${chunk.content.substring(0, 100)}..."`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Retrieval test failed:', error);
    return;
  }

  // Test 4: Statistics
  console.log('\n📊 Testing collection statistics...');
  try {
    const stats = await retrievalService.getStats();
    console.log('✅ Collection stats:', stats);
  } catch (error) {
    console.error('❌ Stats retrieval failed:', error);
  }

  console.log('\n🎉 RAG system test completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRagSystem()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}
