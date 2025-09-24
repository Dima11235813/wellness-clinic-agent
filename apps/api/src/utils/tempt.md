
> @wellness/api@0.1.0 start
> node dist/index.js

Skipping vector store initialization - OpenAI API key not configured
[api] Initializing RAG knowledge base...
[ingestPolicies] Resolved policy path: C:\Dev\wellness-clinic-agent\data\policies\whp-participant-policy-manual-2025.pdf
Found policy manual at: C:\Dev\wellness-clinic-agent\data\policies\whp-participant-policy-manual-2025.pdf
Initializing ingestion service
[INGESTION] Ingesting PDF C:\Dev\wellness-clinic-agent\data\policies\whp-participant-policy-manual-2025.pdf (hash: 48406efcc0c5407d403c35f1a444c484c6b018bcb7460afb22c664650f9e1617)...
[INGESTION] 📖 Loading PDF: C:\Dev\wellness-clinic-agent\data\policies\whp-participant-policy-manual-2025.pdf
Warning: TT: undefined function: 21
Warning: TT: undefined function: 21
Warning: TT: invalid function id: 136
[INGESTION] 📄 PDF loaded: 19 pages found
[INGESTION] ✂️ Splitting documents with chunkSize=1000, overlap=200
[INGESTION] 📑 Documents split into 62 chunks
[INGESTION] 🔢 Processed 10/62 chunks (10 valid)
[INGESTION] 🔢 Processed 20/62 chunks (20 valid)
[INGESTION] 🔢 Processed 30/62 chunks (30 valid)
[INGESTION] 🔢 Processed 40/62 chunks (40 valid)
[INGESTION] 🔢 Processed 50/62 chunks (50 valid)
[INGESTION] 🔢 Processed 60/62 chunks (60 valid)
[INGESTION] ✅ Chunking complete: 62 valid chunks from 62 total splits
[INGESTION] 📄 Sample chunk 0: "Table of Contents - i
UND Wellness Center
Participant Policy Manual
Introduction 1
A.1  Disclaimer .................................................." (978 chars)
[INGESTION] 📄 Sample chunk 1: "Rules and Regulations 3
D.1  General Rules/Regulations ................................................................................3
D.2 ADA Sta..." (952 chars)
[INGESTION] Extracted 62 chunks from PDF
[RETRIEVAL] ❌ Cannot add chunks - vector store not initialized (OpenAI API key not configured)
[INGESTION] ❌ Failed to add chunks to vector store: Error: Vector store not initialized. OpenAI API key is required for vector operations.
    at RetrievalService.addChunks (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/services/retrieval.js:37:19)
    at IngestionService.ingestPolicyPDF (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/services/ingestion.js:121:41)
    at async ingestPolicies (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/scripts/ingestPolicies.js:37:24)
    at async file:///C:/Dev/wellness-clinic-agent/apps/api/dist/index.js:33:9
Failed to ingest policies: Error: Ingestion failed: Vector store not initialized. OpenAI API key is required for vector operations.
    at IngestionService.ingestPolicyPDF (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/services/ingestion.js:125:19)
    at async ingestPolicies (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/scripts/ingestPolicies.js:37:24)
    at async file:///C:/Dev/wellness-clinic-agent/apps/api/dist/index.js:33:9
[api] Failed to initialize RAG knowledge base: Error: Ingestion failed: Vector store not initialized. OpenAI API key is required for vector operations.
    at IngestionService.ingestPolicyPDF (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/services/ingestion.js:125:19)
    at async ingestPolicies (file:///C:/Dev/wellness-clinic-agent/apps/api/dist/scripts/ingestPolicies.js:37:24)
    at async file:///C:/Dev/wellness-clinic-agent/apps/api/dist/index.js:33:9
[api] LangGraph initialized successfully
[api] listening on http://localhost:3000
The issue is that 
Messages that expect the user to wait, should indicate some kind of loading indicator in place of the message we're waiting for example "I understand you're asking about our policies. Let me research that for you."
