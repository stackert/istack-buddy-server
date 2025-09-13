import * as dotenv from 'dotenv';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as fs from 'fs';
import * as path from 'path';

interface SumoLogicCredentials {
  accessId: string;
  accessKey: string;
  endpoint: string;
}

interface ParsedArgs {
  formId?: number;
  startDate?: string;
  endDate?: string;
}

function loadSumoCredentials(): SumoLogicCredentials {
  dotenv.config({ path: '.env.live' });
  
  const accessId = process.env.SUMO_ACCESS_ID;
  const accessKey = process.env.SUMO_ACCESS_KEY;
  const endpoint = process.env.SUMO_ENDPOINT;
  
  if (!accessId || !accessKey || !endpoint) {
    throw new Error('Missing Sumo Logic credentials in .env.live file');
  }
  
  return {
    accessId: accessId.trim(),
    accessKey: accessKey.trim(),
    endpoint: endpoint.trim().replace(/\/%?$/, '')
  };
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

function validateArgs(args: ParsedArgs): string | null {
  if (!args.formId) {
    return 'formId is required';
  }
  
  if (!args.startDate || !args.endDate) {
    return 'Both startDate and endDate are required';
  }
  
  // Validate date format
  const startDate = new Date(args.startDate);
  const endDate = new Date(args.endDate);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 'Invalid date format. Use: "YYYY-MM-DD HH:MM:SS"';
  }
  
  if (startDate >= endDate) {
    return 'Start date must be before end date';
  }
  
  return null;
}

function formatDateForFilename(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function formatDateForReport(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}${hour}${minute}`;
}

function showHelp(): void {
  console.log('');
  console.log('=== Fetch Submissions for Form ===');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node fetch-submissions-for-form.ts formId=<id> startDate="<date>" endDate="<date>"');
  console.log('');
  console.log('Parameters:');
  console.log('  formId     - Form ID (required)');
  console.log('  startDate  - Start date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('  endDate    - End date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node fetch-submissions-for-form.ts formId=2753595 startDate="2025-08-17 07:15:00" endDate="2025-08-17 08:15:00"');
  console.log('');
  console.log('Output:');
  console.log('  Raw results: 20250815/query-output/all-submission-{formId}-{startDate}-{endDate}.log.csv');
  console.log('  Parsed report: 20250815/reports/submitaction-{formId}-{startDate}-{endDate}.json');
  console.log('');
}

async function fetchSubmissionsForForm(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: No arguments provided');
    showHelp();
    process.exit(1);
  }
  
  const parsed = parseNamedArgs(args);
  const validationError = validateArgs(parsed);
  
  if (validationError) {
    console.error(`Error: ${validationError}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    console.log('🔐 Loading credentials...');
    const credentials = loadSumoCredentials();
    
    // Set up cookie jar for persistent cookies
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    
    console.log('');
    console.log('📋 QUERY PARAMETERS:');
    console.log(`   Form ID: ${parsed.formId}`);
    console.log(`   Start: ${parsed.startDate}`);
    console.log(`   End: ${parsed.endDate}`);
    console.log('');
    
    // Use EXACT query that works in Sumo web interface
    const query = `_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId"
| where formId = ${parsed.formId}`;

    console.log('📋 EXACT QUERY BEING SENT:');
    console.log(query);
    console.log('');

    const fromEpoch = new Date(parsed.startDate!).getTime().toString();
    const toEpoch = new Date(parsed.endDate!).getTime().toString();
    
    const payload = {
      query: query,
      from: fromEpoch,
      to: toEpoch
      // Removed timeZone parameter - let Sumo use default
    };
    
    console.log('📅 TIME RANGE BEING SENT:');
    console.log(`   From: ${fromEpoch} (${new Date(parseInt(fromEpoch)).toISOString()})`);
    console.log(`   To: ${toEpoch} (${new Date(parseInt(toEpoch)).toISOString()})`);
    console.log(`   TimeZone: Default (no override)`);
    console.log('');
    
    console.log('🚀 STEP 1: Creating search job...');
    const createJobUrl = `${credentials.endpoint}/v1/search/jobs`;
    
    const createResponse = await client.post(createJobUrl, payload, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    const jobId = createResponse.data.id;
    console.log(`✅ Job created: ${jobId}`);
    
    console.log('⏳ STEP 2: Polling for completion...');
    let attempts = 0;
    const maxAttempts = 600; // 10 minutes for large queries
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}`;
      
      try {
        const statusResponse = await client.get(statusUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        });
        
        const state = statusResponse.data.state;
        const messageCount = statusResponse.data.messageCount || 0;
        const recordCount = statusResponse.data.recordCount || 0;
        
        console.log(`📊 ${attempts}: ${state} (messages: ${messageCount}, records: ${recordCount})`);
        
        if (state === 'DONE GATHERING RESULTS') {
          console.log('🎉 Job completed!');
          
          console.log('📥 STEP 3: Fetching results...');
          
          let allMessages: any[] = [];
          let offset = 0;
          const limit = 1000;
          let hasMore = true;
          
          // Get all results with pagination
          while (hasMore) {
            const messagesUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/messages?offset=${offset}&limit=${limit}`;
            
            try {
              const messageResponse = await client.get(messagesUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Accept': 'application/json'
                }
              });
              
              const messages = messageResponse.data.messages || [];
              allMessages = allMessages.concat(messages);
              
              console.log(`📥 Retrieved ${messages.length} messages (offset: ${offset})`);
              
              if (messages.length < limit) {
                hasMore = false;
              } else {
                offset += limit;
              }
              
            } catch (error: any) {
              console.log(`❌ Failed to get messages at offset ${offset}: ${error.message}`);
              hasMore = false;
            }
          }
          
          console.log(`✅ Total messages retrieved: ${allMessages.length}`);
          
          // Create output directory
          const outputDir = path.join(__dirname, '..', 'query-output');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Generate filename
          const startFormatted = formatDateForFilename(parsed.startDate!);
          const endFormatted = formatDateForFilename(parsed.endDate!);
          const filename = `all-submission-${parsed.formId}-${startFormatted}-${endFormatted}.log.csv`;
          const outputPath = path.join(outputDir, filename);
          
          // Convert to CSV with all available fields
          let csvContent = '_messagetime,_raw\n';
          
          for (const message of allMessages) {
            const messagetime = message.time || '';
            const rawData = message.map._raw || '';
            
            // Escape CSV fields
            const escapeCsvField = (field: string) => {
              if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                return '"' + field.replace(/"/g, '""') + '"';
              }
              return field;
            };
            
            csvContent += `${escapeCsvField(messagetime)},${escapeCsvField(rawData)}\n`;
          }
          
          // Write to file
          fs.writeFileSync(outputPath, csvContent);
          
          console.log('');
          console.log('💾 RAW RESULTS SAVED:');
          console.log(`   File: ${outputPath}`);
          console.log(`   Records: ${allMessages.length}`);
          console.log(`   Size: ${Math.round(csvContent.length / 1024)} KB`);
          
          // === STEP 4: GENERATE PARSED REPORT ===
          console.log('');
          console.log('📊 STEP 4: Generating parsed report...');
          
          // Create reports directory
          const reportsDir = path.join(__dirname, '..', 'reports');
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
          }
          
          // Generate report filename with formId
          const startReportFormatted = formatDateForReport(parsed.startDate!);
          const endReportFormatted = formatDateForReport(parsed.endDate!);
          const reportFilename = `submitaction-${parsed.formId}-${startReportFormatted}-${endReportFormatted}.json`;
          const reportPath = path.join(reportsDir, reportFilename);
          
          // Parse messages and build JSON structure
          const reportData: Record<string, any> = {};
          let parsedCount = 0;
          
          for (const message of allMessages) {
            try {
              const rawData = message.map._raw || '';
              const logData = JSON.parse(rawData);
              
              const formId = logData.context?.formId || '';
              const submissionId = logData.context?.submissionId || '';
              const submissionTime = logData.context?.submissionTime || logData.datetime || message.time || '';
              
              if (formId && submissionId && submissionTime) {
                reportData[submissionId] = {
                  formId: formId,
                  submissionTime: submissionTime,
                  referrer: null,                   // To be populated by actual submit actions query
                  expectedSubmitActions: [],        // formConfiguredSubmitActions
                  expectedSubmitActionsQueued: [],  // queuedIntegrations  
                  expectedSubmitActionsBlocking: [], // blockingIntegrations
                  actualSubmitActions: [],          // Configured actions that executed
                  systemSubmitActions: []           // System actions that executed automatically
                };
                parsedCount++;
              }
              
            } catch (e) {
              // Skip messages that can't be parsed
              continue;
            }
          }
          
          // Write report file as JSON
          const reportContent = JSON.stringify(reportData, null, 2);
          fs.writeFileSync(reportPath, reportContent);
          
          console.log('');
          console.log('📋 PARSED REPORT SAVED:');
          console.log(`   File: ${reportPath}`);
          console.log(`   Records: ${parsedCount} of ${allMessages.length} parsed`);
          console.log(`   Size: ${Math.round(reportContent.length / 1024)} KB`);
          console.log('');
          console.log('✅ SUCCESS!');
          
          return;
          
        } else if (state === 'CANCELLED' || state.includes('ERROR')) {
          throw new Error(`Search job failed with state: ${state}`);
        }
        
      } catch (error: any) {
        console.log(`⚠️ Status check ${attempts}: ${error.message}`);
      }
    }
    
    throw new Error('Search job timed out after 10 minutes');
    
  } catch (error: any) {
    console.log('');
    console.log('💥 ERROR:', error.message);
    if (error.response?.data) {
      console.log('API Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  fetchSubmissionsForForm().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
