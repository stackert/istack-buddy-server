#!/usr/bin/env ts-node

// Simple search test script - Configure search type below
// Usage: npx ts-node ./docs-living/artifacts/scripts/test-search-semantic.ts

// SEARCH TYPE CONFIGURATION - Uncomment the one you want to test
// const SEARCH_TYPE: string = 'semantic-search';
// const SEARCH_TYPE: string = 'keyword-search'; // zero results
const SEARCH_TYPE: string = 'noun-search';
// const SEARCH_TYPE: string = 'proper-noun-search';
// const SEARCH_TYPE: string = 'domain-search';
// const SEARCH_TYPE: string = 'free-text-search';

// Configuration
const BASE_URL = 'http://192.168.1.4:3505';
const AUTH_TOKEN = 'istack-buddy-dev-token-2024';
const API_BASE = `${BASE_URL}/information-services/knowledge-bases`;

const USER_QUERY = `Customer is concerned that the data is visible in the export but not visible on the submission table`;

const SEARCH_LIMIT = 5;
const MAX_CONFIDENCE = 1.0;

async function makeRequest(endpoint: string, data?: any) {
  console.log(`🔄 Making request to: ${endpoint}`);
  if (data) {
    console.log(`📝 Request data keys: ${Object.keys(data).join(', ')}`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    // Try to get more detailed error info
    let errorText = '';
    try {
      errorText = await response.text();
      console.log(`❌ Error response body:`, errorText);
    } catch (e) {
      // Ignore if we can't read the response
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function removeEmbeddings(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeEmbeddings);
  } else if (obj && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip any embedding fields
      if (
        key.includes('embedding') ||
        key === 'vector_graph' ||
        key === 'chunk_embedding'
      ) {
        continue;
      }
      cleaned[key] = removeEmbeddings(value);
    }
    return cleaned;
  }
  return obj;
}

async function main() {
  try {
    console.log(`🚀 Search Test - ${SEARCH_TYPE}`);
    console.log('========================');
    console.log(`Query: "${USER_QUERY}"`);
    console.log('');

    // Step 1: PreQuery
    console.log('📋 STEP 1: PREQUERY RESULTS');
    console.log('===========================');

    const preQueryData = { query: USER_QUERY };
    const preQueryResponse = await makeRequest(
      `${API_BASE}/preQuery`,
      preQueryData,
    );

    // Remove embeddings and pretty print
    const cleanPreQuery = removeEmbeddings(preQueryResponse);
    console.log(JSON.stringify(cleanPreQuery, null, 2));

    console.log('');

    // Step 2: Search
    console.log(`🔍 STEP 2: SEARCH RESULTS (${SEARCH_TYPE})`);
    console.log('==================================');

    // Prepare search data based on endpoint DTO requirements
    let searchData: any = {
      maxConfidence: MAX_CONFIDENCE,
      limit: SEARCH_LIMIT,
      // Let it use default channels (now fixed to correct case)
    };

    // Add the specific field each endpoint's DTO expects
    switch (SEARCH_TYPE) {
      case 'semantic-search':
        searchData.userPromptText = preQueryResponse.userPromptText;
        break;
      case 'keyword-search':
        searchData.keywords = preQueryResponse.keywords;
        break;
      case 'noun-search':
        searchData.nouns = preQueryResponse.nouns;
        break;
      case 'proper-noun-search':
        searchData.properNouns = preQueryResponse.properNouns;
        break;
      case 'domain-search':
        searchData.domains = preQueryResponse.domains;
        break;
      case 'free-text-search':
        // Fix: freeText might be null/undefined, provide fallback
        searchData.freeText = preQueryResponse.freeText ||
          preQueryResponse.keywords || ['text', 'search'];
        console.log(
          `🔍 Free text search data: freeText=${JSON.stringify(searchData.freeText)}`,
        );
        break;
      default:
        throw new Error(`Unknown search type: ${SEARCH_TYPE}`);
    }

    const searchResponse = await makeRequest(
      `${API_BASE}/${SEARCH_TYPE}`,
      searchData,
    );

    // Remove embeddings and pretty print
    const cleanSearchResults = removeEmbeddings(searchResponse);
    console.log(JSON.stringify(cleanSearchResults, null, 2));

    // Results Summary Breakdown
    console.log('');
    console.log('📊 SEARCH RESULTS BREAKDOWN');
    console.log('==========================');

    const slackCount = searchResponse.SLACK ? searchResponse.SLACK.length : 0;
    const contextDocsCount = searchResponse['CONTEXT-DOCUMENTS']
      ? searchResponse['CONTEXT-DOCUMENTS'].length
      : 0;
    const totalCount = slackCount + contextDocsCount;

    console.log(`🔍 Search Type: ${SEARCH_TYPE.toUpperCase()}`);
    console.log(`📈 Total Results: ${totalCount}`);
    console.log(`💬 SLACK: ${slackCount} results`);
    console.log(`📄 CONTEXT-DOCUMENTS: ${contextDocsCount} results`);

    if (totalCount > 0) {
      const slackPercent = ((slackCount / totalCount) * 100).toFixed(1);
      const contextPercent = ((contextDocsCount / totalCount) * 100).toFixed(1);
      console.log(
        `📊 Distribution: SLACK ${slackPercent}%, CONTEXT-DOCUMENTS ${contextPercent}%`,
      );

      // Show first result from each knowledge base if available
      if (slackCount > 0) {
        const firstSlack = searchResponse.SLACK[0];
        console.log(
          `💬 First SLACK result confidence: ${firstSlack.confidence || 'N/A'}`,
        );
      }
      if (contextDocsCount > 0) {
        const firstContext = searchResponse['CONTEXT-DOCUMENTS'][0];
        console.log(
          `📄 First CONTEXT-DOCUMENTS result confidence: ${firstContext.confidence || 'N/A'}`,
        );
      }
    } else {
      console.log(
        '⚠️  No results found - check channel configuration and data availability',
      );
    }

    console.log('');
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
