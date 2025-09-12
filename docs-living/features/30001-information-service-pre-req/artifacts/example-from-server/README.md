# Test Scripts

## test-prequery.sh

Enhanced script to test the multi-chunk embedding search workflow.

**Usage:**
1. Set up the database and embeddings:
   ```bash
   npm run db:reset
   npm run docs:populate
   npm run docs:embed
   ```
2. Start the server: `npm run start:dev`
3. Run the script: `./docs-living/artifacts/scripts/test-prequery.sh`

**What it does:**
- Tests preQuery endpoint with automatic query chunking and embedding
- Tests context-documents search with enhanced metadata
- Tests slack search with same query data
- Demonstrates complete multi-chunk search workflow

## search-context-documents.sh

Comprehensive test script for context document search capabilities.

**Usage:**
1. Ensure embeddings are generated: `npm run docs:embed`
2. Start the server: `npm run start:dev`  
3. Run the script: `./docs-living/artifacts/scripts/search-context-documents.sh`

**What it tests:**
- API Authentication search (technical documentation)
- Form Validation search (multi-channel search)
- Backend Architecture search (system overview)
- Broad overview search (semantic similarity across channels)

## Key Features

**🧠 Intelligent Query Processing:**
- Automatic query chunking for long queries
- Multi-embedding generation for complex searches
- Enhanced metadata extraction using Intellistack terminology

**🎯 Semantic Search Capabilities:**
- Vector similarity search using OpenAI embeddings
- Multi-chunk query matching against document chunks
- Similarity scoring and result aggregation
- Channel-specific and multi-channel searches

**📊 Enhanced Responses:**
- Chunk-level search results with confidence scores
- File path tracking and document titles
- Keywords, domains, and proper noun metadata
- Query-to-document chunk matching information

**Expected Response Format:**
```json
[
  {
    "excerptText": "API authentication requires Bearer tokens...",
    "fullText": "Complete chunk text with authentication details...",
    "confidence": "0.892",
    "channelId": "CONTEXT-DOCUMENTS:CORE-FORMS-BE",
    "metadata": {
      "documentTitle": "API v2 Authentication Guide",
      "filePath": "core-forms-be/api-authentication.md",
      "chunkIndex": 0,
      "keywords": "api|authentication|bearer|token",
      "domains": "API:V2|BACKEND:AUTHENTICATION",
      "matchingQueryChunks": [
        {
          "index": 0,
          "text": "User query chunk about authentication",
          "similarity": 0.892
        }
      ]
    }
  }
]
```