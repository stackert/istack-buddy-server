#!/usr/bin/env ts-node

// Simple Sumo Logic test script  
// Usage: npx ts-node ./docs-living/artifacts/scripts/test-sumo-searches.ts

// Make this file a module to avoid global scope conflicts
export {};

// QUERY PARAMETERS - Set to null to omit from query
// You will need to look in Sumo Logic to find values for these with current history
// submitActionId: 7344918
// formId: 6052707 // submissionCreatedForForm
// formId: 2606894 // submitActionSelectedForExecution
// authProviderId: 1107

const queryParams = {
  authProviderId: null as string | null,
  formId: null as string | null,
  submissionId: null as string | null,
  submitActionId: "7344918"  as string | null
};

  // SEARCH CONFIGURATION
  const searchConfig = {
    // searchType: 'submissionCreatedForForm', // submissionCreatedForForm | submitActionReport | authProviderMetrics | submitActionSelectedForExecution
    // searchType: 'submitActionSelectedForExecution', //  submitActionSelectedForExecution
    // searchType: 'authProviderMetrics', //  submitActionSelectedForExecution
    searchType: 'submitActionReport', // authProviderMetrics | submitActionSelectedForExecution
    fromDate: '2025-09-07T00:00:00.000Z', // ISO 8601 format - INVALID: more than 91 days past
    toDate: '2025-09-14T23:59:59.999Z'    // INVALID: more than 91 days past - should trigger validation error
  };

const BASE_URL = 'http://localhost:3505';
const AUTH_TOKEN = 'istack-buddy-dev-token-2024';

async function runSumoTest() {
  console.log(`🔍 Testing Sumo query: ${searchConfig.searchType}`);
  
  // Build subject object from non-null params
  const subject: any = { startDate: searchConfig.fromDate, endDate: searchConfig.toDate };
  Object.entries(queryParams).forEach(([key, value]) => { if (value) subject[key] = value; });
  
  // Submit job
  const submitResponse = await fetch(`${BASE_URL}/information-services/context-sumo-report/query/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
    body: JSON.stringify({ queryName: searchConfig.searchType, subject })
  });
  
  if (!submitResponse.ok) {
    console.error(`❌ Submit failed: ${submitResponse.status} ${submitResponse.statusText}`);
    console.error(await submitResponse.text());
    return;
  }
  
  const submitResult = await submitResponse.json();
  console.log(`📋 Submit response:`, submitResult);
  const jobId = submitResult.jobId;

  // Poll status every 10 seconds  
  let attempts = 0;
  while (attempts < 30) { // Max 5 minutes
    attempts++;
    const statusResponse = await fetch(`${BASE_URL}/information-services/context-sumo-report/query/${jobId}/status`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    if (!statusResponse.ok) {
      console.error(`❌ Status check failed: ${statusResponse.status}`);
      break;
    }
    
    const status = await statusResponse.json();
    console.log(`⏳ Attempt ${attempts} - Full status:`, status);
    
    if (status.state === 'DONE GATHERING RESULTS' || status.status === 'completed') {
      // Get results
      const resultsResponse = await fetch(`${BASE_URL}/information-services/context-sumo-report/query/${jobId}/results`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      const results = await resultsResponse.json();
      console.log(`✅ Results (${results.length} records):`);
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    
    if (attempts < 30) {
      console.log(`⏱️  Waiting 10 seconds... (${attempts}/30)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log('⚠️  Timeout after 5 minutes - check job status manually');
}

runSumoTest().catch(console.error);
