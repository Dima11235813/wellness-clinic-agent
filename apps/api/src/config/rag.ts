export const RAG_CONFIG = {
  // Embedding configuration
  embedding: {
    model: 'text-embedding-3-small',
  },

  // Text chunking configuration
  chunking: {
    chunkSize: 1000,
    chunkOverlap: 200,
  },

  // Retrieval configuration
  retrieval: {
    topK: 5,
  },

  // Vector store configuration (in-memory)
  vectorStore: {
    type: 'memory',
  },

  // Document paths
  documents: {
    policyManual: '../../../../data/policies/whp-participant-policy-manual-2025.pdf',
  },
} as const;
