#!/usr/bin/env ts-node

// Simple keyword search test for 'webhooks'
// Usage: npx ts-node test-keyword-search-webhooks.ts

import * as fs from 'fs';

// Configuration
const BASE_URL = 'http://192.168.1.4:3505';
const AUTH_TOKEN = 'istack-buddy-dev-token-2024';
const API_BASE = `${BASE_URL}/information-services/knowledge-bases`;

const USER_QUERY = 'webhooks';
const SEARCH_LIMIT = 10;
const MAX_CONFIDENCE = 1.0;

async function makeRequest(endpoint: string, data?: any) {
  console.log(`🔄 Making request to: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  try {
    console.log('🚀 Keyword Search Test - webhooks');
    console.log('==================================');

    // Step 1: PreQuery
    console.log('📋 Step 1: PreQuery');
    const preQueryData = { query: USER_QUERY };
    const preQueryResponse = await makeRequest(
      `${API_BASE}/preQuery`,
      preQueryData,
    );
    console.log('✅ PreQuery completed');

    // Step 2: Keyword Search
    console.log('🔍 Step 2: Keyword Search');
    const searchData = {
      keywords: preQueryResponse.keywords,
      maxConfidence: MAX_CONFIDENCE,
      limit: SEARCH_LIMIT,
    };

    const searchResponse = await makeRequest(
      `${API_BASE}/keyword-search`,
      searchData,
    );
    console.log('✅ Keyword search completed');

    // Step 3: Write results to file
    console.log('💾 Step 3: Writing results to file');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `keyword-search-webhooks-${timestamp}.json`;

    const results = {
      query: USER_QUERY,
      keywords: preQueryResponse.keywords,
      searchResponse: searchResponse,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`✅ Results written to: ${filename}`);

    // Summary
    const slackCount = searchResponse.SLACK ? searchResponse.SLACK.length : 0;
    const contextCount = searchResponse['CONTEXT-DOCUMENTS']
      ? searchResponse['CONTEXT-DOCUMENTS'].length
      : 0;

    console.log('');
    console.log('📊 RESULTS SUMMARY');
    console.log('==================');
    console.log(`🔍 Query: "${USER_QUERY}"`);
    console.log(`📈 Keywords: ${preQueryResponse.keywords.join(', ')}`);
    console.log(`📈 Total Results: ${slackCount + contextCount}`);
    console.log(`💬 SLACK: ${slackCount} results`);
    console.log(`📄 CONTEXT-DOCUMENTS: ${contextCount} results`);
    console.log(`📁 File: ${filename}`);

    console.log('');
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();

