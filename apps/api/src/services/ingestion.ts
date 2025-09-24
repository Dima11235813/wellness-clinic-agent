import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { sha256, hashFile } from '../utils/hash.js';
import { RetrievalService } from './retrieval.js';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';

export interface ChunkMetadata {
  filename: string;
  pageNumber: number;
  chunkIndex: number;
  docHash: string;
  chunkHash: string;
  ingestedAt: string;
  content: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
}

export interface IngestionResult {
  chunksProcessed: number;
  chunksSkipped: number;
  totalChunks: number;
  docHash: string;
  wasReingested: boolean;
}

export class IngestionService {
  private retrievalService: RetrievalService;
  private processedHashes: Set<string> = new Set();

  constructor(retrievalService: RetrievalService) {
    console.log(`Initializing ingestion service`);
    this.retrievalService = retrievalService;
  }

  /**
   * Check if PDF needs re-ingestion based on hash
   */
  private async needsReingestion(pdfPath: string): Promise<{ needsReingestion: boolean; docHash: string }> {
    const docHash = await hashFile(pdfPath);

    // Check if we've already processed this document hash
    const needsReingestion = !this.processedHashes.has(docHash);

    return {
      needsReingestion,
      docHash,
    };
  }

  /**
   * Load and chunk PDF document
   */
  private async loadAndChunkPDF(pdfPath: string): Promise<{ chunks: string[]; metadatas: ChunkMetadata[] }> {
    console.log(`[INGESTION] 📖 Loading PDF: ${pdfPath}`);

    const loader = new PDFLoader(pdfPath, {
      splitPages: true,
    });

    const docs = await loader.load();
    console.log(`[INGESTION] 📄 PDF loaded: ${docs.length} pages found`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    console.log(`[INGESTION] ✂️ Splitting documents with chunkSize=1000, overlap=200`);
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`[INGESTION] 📑 Documents split into ${splitDocs.length} chunks`);

    const chunks: string[] = [];
    const metadatas: ChunkMetadata[] = [];

    for (let i = 0; i < splitDocs.length; i++) {
      const doc = splitDocs[i];
      const content = doc.pageContent.trim();

      if (!content) {
        console.log(`[INGESTION] ⚠️ Skipping empty chunk at index ${i}`);
        continue;
      }

      if (content.length < 50) {
        console.log(`[INGESTION] ⚠️ Skipping very short chunk (${content.length} chars) at index ${i}: "${content}"`);
        continue;
      }

      const chunkHash = sha256(content);
      const filename = path.basename(pdfPath);

      chunks.push(content);
      const pageNumber = (doc.metadata.page || 1) as number;
      const baseSource = process.env.POLICY_SOURCE_URL || '';
      metadatas.push({
        filename,
        pageNumber,
        chunkIndex: i,
        docHash: '', // Will be set later
        chunkHash,
        ingestedAt: new Date().toISOString(),
        content,
        sourceUrl: baseSource || undefined,
        sourcePageUrl: baseSource ? `${baseSource}#page=${pageNumber}` : undefined,
      });

      // Log every 10th chunk for progress tracking
      if ((i + 1) % 10 === 0) {
        console.log(`[INGESTION] 🔢 Processed ${i + 1}/${splitDocs.length} chunks (${chunks.length} valid)`);
      }
    }

    console.log(`[INGESTION] ✅ Chunking complete: ${chunks.length} valid chunks from ${splitDocs.length} total splits`);

    // Log some sample chunks
    if (chunks.length > 0) {
      console.log(`[INGESTION] 📄 Sample chunk 0: "${chunks[0].substring(0, 150)}..." (${chunks[0].length} chars)`);
      if (chunks.length > 1) {
        console.log(`[INGESTION] 📄 Sample chunk 1: "${chunks[1].substring(0, 150)}..." (${chunks[1].length} chars)`);
      }
    }

    return { chunks, metadatas };
  }

  /**
   * Ingest policy PDF into vector store
   */
  async ingestPolicyPDF(pdfPath: string): Promise<IngestionResult> {
    const { needsReingestion, docHash } = await this.needsReingestion(pdfPath);

    if (!needsReingestion) {
      console.log(`PDF ${pdfPath} already ingested (hash: ${docHash}), skipping...`);
      return {
        chunksProcessed: 0,
        chunksSkipped: 0,
        totalChunks: 0,
        docHash,
        wasReingested: false,
      };
    }

    console.log(`[INGESTION] Ingesting PDF ${pdfPath} (hash: ${docHash})...`);

    // Load and chunk the PDF
    const { chunks, metadatas } = await this.loadAndChunkPDF(pdfPath);

    if (chunks.length === 0) {
      throw new Error('No content chunks extracted from PDF');
    }

    console.log(`[INGESTION] Extracted ${chunks.length} chunks from PDF`);

    // Set docHash on all metadatas
    metadatas.forEach(metadata => {
      metadata.docHash = docHash;
    });

    // Prepare chunks for storage (MemoryVectorStore handles embeddings internally)
    const storedChunks = metadatas.map((metadata, index) => ({
      id: `${docHash}_${index}`,
      content: chunks[index],
      embedding: [], // Not needed for MemoryVectorStore
      metadata,
    }));

    // Store in retrieval service (vector store handles embeddings)
    try {
      await this.retrievalService.addChunks(storedChunks);
    } catch (error) {
      console.error(`[INGESTION] ❌ Failed to add chunks to vector store:`, error);
      throw new Error(`Ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Mark this document as processed
    this.processedHashes.add(docHash);

    console.log(`[INGESTION] ✅ Successfully ingested ${chunks.length} chunks for document ${docHash}`);
    console.log(`[INGESTION] 📊 Total processed documents: ${this.processedHashes.size}`);
    console.log(`[INGESTION] 📊 Total chunks in vector store: ${await this.retrievalService.getStats().then(s => s.totalChunks)}`);

    return {
      chunksProcessed: chunks.length,
      chunksSkipped: 0,
      totalChunks: chunks.length,
      docHash,
      wasReingested: true,
    };
  }
}
