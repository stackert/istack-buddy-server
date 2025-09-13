import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

interface SumoQueryOptions {
  formId: number;
  startDate: string;
  endDate: string;
}

interface ParsedArgs {
  formId?: number;
  startDate?: string;
  endDate?: string;
}

interface SumoLogicCredentials {
  accessId: string;
  accessKey: string;
  endpoint: string;
}

interface SumoSearchJobResponse {
  id: string;
  link: {
    rel: string;
    href: string;
  };
}

interface SumoSearchResult {
  type: 'messages' | 'records';
  jobId: string;
  messageCount: number;
  recordCount: number;
  data: {
    messages?: Array<{
      time?: string;
      map: Record<string, any>;
    }>;
    records?: Array<{
      map: Record<string, any>;
    }>;
    fields?: Array<{
      name: string;
      fieldType: string;
      keyField: boolean;
    }>;
  };
}

function generateSubmissionCreatedQuery(options: SumoQueryOptions): string {
  const { formId, startDate, endDate } = options;
  
  const query = `_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId" as formId
| where formId = ${formId}
| where _messageTime >= "${startDate}" and _messageTime <= "${endDate}"
| json field=_raw "context.submissionId" as submissionId
| json field=_raw "context.submissionTime" as submissionTime
| fields _messageTime, submissionId, submissionTime, formId
| sort by _messageTime desc`;

  return query;
}

function parseNamedArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (!key || !value) continue;
    
    switch (key.toLowerCase()) {
      case 'formid':
        const formIdNum = parseInt(value);
        if (!isNaN(formIdNum)) {
          parsed.formId = formIdNum;
        }
        break;
      case 'startdate':
        parsed.startDate = value.replace(/^["']|["']$/g, '');
        break;
      case 'enddate':
        parsed.endDate = value.replace(/^["']|["']$/g, '');
        break;
    }
  }
  
  return parsed;
}

function validateFormId(formId?: number): string | null {
  if (formId === undefined) {
    return 'Form ID is required';
  }
  
  if (formId === 999999) { // _FIELD_ID_ placeholder check
    return 'Form ID appears to be placeholder (_FIELD_ID_). Please provide a real form ID.';
  }
  
  if (formId < 99999 || formId > 9999999) {
    return 'Form ID must be between 99999 and 9999999';
  }
  
  return null;
}

function validateDates(startDate?: string, endDate?: string): string | null {
  if (!startDate || !endDate) {
    return 'Both startDate and endDate are required';
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date format. Use: "YYYY-MM-DD HH:MM:SS"';
  }
  
  if (start >= end) {
    return 'Start date must be before end date';
  }
  
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) {
    return 'Date range cannot exceed 24 hours';
  }
  
  if (end > twoDaysFromNow) {
    return 'End date cannot be more than 2 days in the future (Sumo Logic constraint)';
  }
  
  if (start < oneYearAgo) {
    return 'Start date cannot be more than 1 year ago (Sumo Logic constraint)';
  }
  
  return null;
}

function loadSumoCredentials(): SumoLogicCredentials {
  // Load environment variables from .env.live
  dotenv.config({ path: '.env.live' });
  
  const accessId = process.env.SUMO_ACCESS_ID;
  const accessKey = process.env.SUMO_ACCESS_KEY;
  const endpoint = process.env.SUMO_ENDPOINT;
  
  if (!accessId || accessId.trim() === '') {
    throw new Error('SUMO_ACCESS_ID is missing or empty in .env.live file');
  }
  
  if (!accessKey || accessKey.trim() === '') {
    throw new Error('SUMO_ACCESS_KEY is missing or empty in .env.live file');
  }
  
  if (!endpoint || endpoint.trim() === '') {
    throw new Error('SUMO_ENDPOINT is missing or empty in .env.live file');
  }
  
  return {
    accessId: accessId.trim(),
    accessKey: accessKey.trim(),
    endpoint: endpoint.trim().replace(/\/%?$/, '') // Remove trailing /% or /
  };
}

async function executeSumoQuery(query: string, credentials: SumoLogicCredentials, startDate: string, endDate: string): Promise<SumoSearchResult> {
  const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
  
  try {
    // Step 1: Start the search job
    const createJobUrl = `${credentials.endpoint}/v1/search/jobs`;
    console.log(`Starting Sumo Logic search job at: ${createJobUrl}`);
    const searchResponse = await axios.post(
      createJobUrl,
      {
        query: query,
        from: new Date(startDate).getTime().toString(),
        to: new Date(endDate).getTime().toString(),
        timeZone: 'America/New_York'
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const jobId = searchResponse.data.id;
    console.log(`Search job started with ID: ${jobId}`);
    
    // Step 2: Poll for job status and get results when ready
    console.log('Polling for search completion...');
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 0.5 seconds (faster polling)
      attempts++;
      
      try {
        // Check job status
        const statusUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}`;
        const statusResponse = await axios.get(
          statusUrl,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const state = statusResponse.data.state;
        const messageCount = statusResponse.data.messageCount || 0;
        const recordCount = statusResponse.data.recordCount || 0;
        
        console.log(`Status: ${state}, messages: ${messageCount}, records: ${recordCount} (${attempts}/${maxAttempts})`);
        
        if (state === 'DONE GATHERING RESULTS') {
          console.log('🎉 Job completed! Retrieving results immediately...');
          
          // Try messages first (for log searches)
          try {
            const messagesUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/messages?offset=0&limit=100`;
            console.log(`📨 Trying messages: ${messagesUrl}`);
            
            const messageResponse = await axios.get(messagesUrl, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            });
            
            console.log('✅ Messages retrieved successfully!');
            return {
              type: 'messages',
              jobId: jobId,
              messageCount: messageCount,
              recordCount: recordCount,
              data: messageResponse.data
            };
            
          } catch (msgError: any) {
            console.log(`❌ Messages failed: ${msgError.response?.status} - ${msgError.response?.data?.message || msgError.message}`);
            
            // Try records as fallback (for aggregate searches)  
            try {
              const recordsUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/records?offset=0&limit=100`;
              console.log(`📊 Trying records: ${recordsUrl}`);
              
              const recordResponse = await axios.get(recordsUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Accept': 'application/json'
                }
              });
              
              console.log('✅ Records retrieved successfully!');
              return {
                type: 'records',
                jobId: jobId, 
                messageCount: messageCount,
                recordCount: recordCount,
                data: recordResponse.data
              };
              
            } catch (recError: any) {
              console.log(`❌ Records failed: ${recError.response?.status} - ${recError.response?.data?.message || recError.message}`);
              throw new Error(`Both endpoints failed - Messages: ${msgError.response?.status}, Records: ${recError.response?.status}`);
            }
          }
        } else if (statusResponse.data.state === 'CANCELLED' || statusResponse.data.state.includes('ERROR')) {
          throw new Error(`Search job failed with state: ${statusResponse.data.state}`);
        }
        
        // Job still running, continue polling
        
      } catch (error: any) {
        if (error.response?.status === 202) {
          // Job still running
          console.log(`Search still running... (${attempts}/${maxAttempts})`);
          continue;
        } else if (error.message.includes('All result endpoints failed') || error.message.includes('Search job failed')) {
          throw error;
        } else {
          console.log(`Status check failed: ${error.response?.status} - ${error.message}`);
          continue;
        }
      }
    }
    
    throw new Error('Search job timed out after 60 seconds');
    
  } catch (error: any) {
    console.error('Error executing Sumo Logic query:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

function formatResults(results: SumoSearchResult): void {
  console.log('');
  console.log('=== SUMO LOGIC SEARCH RESULTS ===');
  console.log('');
  
  console.log(`📋 Result Type: ${results.type}`);
  console.log(`🆔 Job ID: ${results.jobId}`);
  console.log(`📨 Message Count: ${results.messageCount}`);
  console.log(`📊 Record Count: ${results.recordCount}`);
  console.log('');
  
  const data = results.data;
  
  if (results.type === 'messages') {
    // Handle messages format
    if (!data.messages || data.messages.length === 0) {
      console.log('No messages found.');
      return;
    }
    
    console.log(`Found ${data.messages.length} messages:`);
    console.log('');
    
    data.messages.forEach((message: any, index: number) => {
      console.log(`📄 Message ${index + 1}:`);
      console.log(`   Time: ${message.time || 'N/A'}`);
      console.log(`   Content: ${message.map._raw || message.map._messagetime || JSON.stringify(message.map).substring(0, 200)}...`);
      console.log('');
    });
    
  } else if (results.type === 'records') {
    // Handle records format
    if (!data.records || data.records.length === 0) {
      console.log('No records found.');
      return;
    }
    
    console.log(`Found ${data.records.length} records:`);
    console.log('');
    
    // Print header if fields available
    if (data.fields) {
      const fieldNames = data.fields.map((f: any) => f.name);
      console.log(fieldNames.join('\t'));
      console.log('-'.repeat(fieldNames.join('\t').length));
      
      // Print records
      data.records.forEach((record: any) => {
        const values = fieldNames.map((field: string) => record.map[field] || 'N/A');
        console.log(values.join('\t'));
      });
    } else {
      // Fallback: print raw record data
      data.records.forEach((record: any, index: number) => {
        console.log(`📊 Record ${index + 1}:`);
        console.log(`   ${JSON.stringify(record.map, null, 2)}`);
        console.log('');
      });
    }
  }
  
  console.log('');
  console.log(`✅ Total results displayed: ${results.type === 'messages' ? data.messages?.length : data.records?.length}`);
}

function showHelp(): void {
  console.log('');
  console.log('=== Sumo Logic Query Executor ===');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node generate-sumo-query.ts formId=<id> startDate="<date>" endDate="<date>"');
  console.log('');
  console.log('Parameters:');
  console.log('  formId     - Form ID (required, between 99999 and 9999999)');
  console.log('  startDate  - Start date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('  endDate    - End date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('');
  console.log('Constraints:');
  console.log('  - Date range must be 24 hours or less');
  console.log('  - Dates cannot be in the future');
  console.log('  - Dates cannot be more than 90 days ago');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node generate-sumo-query.ts formId=5819459 startDate="2025-08-15 00:00:00" endDate="2025-08-15 23:59:59"');
  console.log('');
  console.log('Note: This script will execute the query against Sumo Logic and display results.');
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  // Show help if no arguments provided
  if (args.length === 0) {
    console.error('Error: No arguments provided');
    showHelp();
    process.exit(1);
  }
  
  // Parse named arguments
  const parsed = parseNamedArgs(args);
  
  // Validate form ID
  const formIdError = validateFormId(parsed.formId);
  if (formIdError) {
    console.error(`Error: ${formIdError}`);
    showHelp();
    process.exit(1);
  }
  
  // Validate dates
  const dateError = validateDates(parsed.startDate, parsed.endDate);
  if (dateError) {
    console.error(`Error: ${dateError}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    // Load Sumo Logic credentials
    console.log('Loading Sumo Logic credentials...');
    const credentials = loadSumoCredentials();
    
    // Generate query
    const query = generateSubmissionCreatedQuery({
      formId: parsed.formId!,
      startDate: parsed.startDate!,
      endDate: parsed.endDate!
    });

    console.log('');
    console.log('=== EXECUTING SUMO LOGIC QUERY ===');
    console.log('');
    console.log('Query:');
    console.log(query);
    console.log('');
    console.log(`Searching for submissions on form ${parsed.formId} between ${parsed.startDate} and ${parsed.endDate}`);
    console.log('');
    
    // Execute query and display results
    const results = await executeSumoQuery(query, credentials, parsed.startDate!, parsed.endDate!);
    formatResults(results);
    
  } catch (error: any) {
    console.error('');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error.message);
    process.exit(1);
  });
}
