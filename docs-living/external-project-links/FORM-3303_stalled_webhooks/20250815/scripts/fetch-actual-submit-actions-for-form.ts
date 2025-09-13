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
  console.log('=== Fetch Actual Submit Actions for Form ===');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node fetch-actual-submit-actions-for-form.ts formId=<id> startDate="<date>" endDate="<date>"');
  console.log('');
  console.log('Parameters:');
  console.log('  formId     - Form ID (required)');
  console.log('  startDate  - Start date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('  endDate    - End date in format "YYYY-MM-DD HH:MM:SS"');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node fetch-actual-submit-actions-for-form.ts formId=4799476 startDate="2025-08-18 06:15:00" endDate="2025-08-18 07:15:00"');
  console.log('');
  console.log('Output:');
  console.log('  Raw results: 20250815/query-output/actual-submit-actions-{formId}-{startDate}-{endDate}.log.csv');
  console.log('  Updates report: 20250815/reports/submitaction-{formId}-{startDate}-{endDate}.json');
  console.log('  (Populates actualSubmitActions with timing analysis and adds referrer)');
  console.log('  Each action includes: type, id, runTime, timeAfterSubmission, isLikelyReRun');
  console.log('');
}

async function fetchActualSubmitActionsForForm(): Promise<void> {
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
    
    // Use correct query for actual submit actions (broader source category)
    const query = `_sourceCategory=formstack/prod/*
"SubmitAction {type} run for {submissionId}"
| json field=_raw "context.type" as submitActionType
| json field=_raw "context.formId" as formId
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
          const filename = `actual-submit-actions-${parsed.formId}-${startFormatted}-${endFormatted}.log.csv`;
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
          console.log('💾 ACTUAL SUBMIT ACTIONS SAVED:');
          console.log(`   File: ${outputPath}`);
          console.log(`   Records: ${allMessages.length}`);
          console.log(`   Size: ${Math.round(csvContent.length / 1024)} KB`);
          
          // === STEP 4: UPDATE REPORT JSON ===
          console.log('');
          console.log('📊 STEP 4: Updating report with actual submit actions...');
          
          const reportsDir = path.join(__dirname, '..', 'reports');
          const startReportFormatted = formatDateForReport(parsed.startDate!);
          const endReportFormatted = formatDateForReport(parsed.endDate!);
          const reportFilename = `submitaction-${parsed.formId}-${startReportFormatted}-${endReportFormatted}.json`;
          const reportPath = path.join(reportsDir, reportFilename);
          
          // Read existing report if it exists
          let reportData: Record<string, any> = {};
          
          if (fs.existsSync(reportPath)) {
            try {
              const reportContent = fs.readFileSync(reportPath, 'utf-8');
              reportData = JSON.parse(reportContent);
              console.log(`📖 Loaded existing report with ${Object.keys(reportData).length} submissions`);
            } catch (e) {
              console.log('⚠️ Could not parse existing report, skipping update');
              console.log('✅ SUCCESS!');
              return;
            }
          } else {
            console.log('⚠️ No existing report found, skipping update');
            console.log('✅ SUCCESS!');
            return;
          }
          
          // Parse actual submit actions data and update report
          let updatedSubmissions = 0;
          
          for (const message of allMessages) {
            try {
              const rawData = message.map._raw || '';
              const logData = JSON.parse(rawData);
              
              const submissionId = logData.context?.submissionId?.toString() || '';
              const actionType = logData.context?.type || '';
              const submitActionId = logData.context?.submitActionId || null;
              const referrer = logData.extra?.referrer || null;
              const runTime = logData.datetime || message.time || '';
              
              if (submissionId && actionType) {
                // Check if this submission exists in our report
                if (reportData[submissionId]) {
                  
                  // Add referrer to submission record
                  if (referrer !== null) {
                    reportData[submissionId].referrer = referrer;
                  } else if (!reportData[submissionId].hasOwnProperty('referrer')) {
                    reportData[submissionId].referrer = null;
                  }
                  
                  // Calculate time after submission
                  let timeAfterSubmission = 0;
                  let isLikelyReRun = false;
                  
                  if (runTime && reportData[submissionId].submissionTime) {
                    try {
                      const runTimeDate = new Date(runTime);
                      const submissionTimeDate = new Date(reportData[submissionId].submissionTime);
                      
                      if (!isNaN(runTimeDate.getTime()) && !isNaN(submissionTimeDate.getTime())) {
                        timeAfterSubmission = (runTimeDate.getTime() - submissionTimeDate.getTime()) / 1000; // seconds
                        isLikelyReRun = timeAfterSubmission > 600; // 10 minutes
                      }
                    } catch (e) {
                      // If date parsing fails, leave as defaults
                    }
                  }
                  
                  // Check if this is a configured or system action
                  const allExpectedTypes = new Set<string>();
                  reportData[submissionId].expectedSubmitActions?.forEach((action: any) => allExpectedTypes.add(action.type));
                  reportData[submissionId].expectedSubmitActionsQueued?.forEach((action: any) => allExpectedTypes.add(action.type));
                  reportData[submissionId].expectedSubmitActionsBlocking?.forEach((action: any) => allExpectedTypes.add(action.type));
                  
                  const isConfiguredAction = allExpectedTypes.has(actionType);
                  
                  // Create action data with enhanced timing info
                  const actionData = {
                    type: actionType,
                    id: submitActionId,
                    runTime: runTime,
                    timeAfterSubmission: timeAfterSubmission,
                    isLikelyReRun: isLikelyReRun
                  };
                  
                  if (isConfiguredAction) {
                    // This is a configured submit action
                    if (!reportData[submissionId].actualSubmitActions) {
                      reportData[submissionId].actualSubmitActions = [];
                    }
                    
                    // Check if this exact execution already exists
                    const existingActions = reportData[submissionId].actualSubmitActions;
                    const actionExists = existingActions.some((existing: any) => 
                      existing.type === actionType && 
                      existing.id === submitActionId && 
                      existing.runTime === runTime
                    );
                    
                    if (!actionExists) {
                      reportData[submissionId].actualSubmitActions.push(actionData);
                      
                      // Sort by runTime (chronological order)
                      reportData[submissionId].actualSubmitActions.sort((a: any, b: any) => {
                        const timeA = new Date(a.runTime || 0).getTime();
                        const timeB = new Date(b.runTime || 0).getTime();
                        return timeA - timeB;
                      });
                    }
                    
                  } else {
                    // This is a system submit action (automatic)
                    if (!reportData[submissionId].systemSubmitActions) {
                      reportData[submissionId].systemSubmitActions = [];
                    }
                    
                    // Check if this exact execution already exists
                    const existingSystemActions = reportData[submissionId].systemSubmitActions;
                    const systemActionExists = existingSystemActions.some((existing: any) => 
                      existing.type === actionType && 
                      existing.id === submitActionId && 
                      existing.runTime === runTime
                    );
                    
                    if (!systemActionExists) {
                      reportData[submissionId].systemSubmitActions.push(actionData);
                      
                      // Sort by runTime (chronological order)
                      reportData[submissionId].systemSubmitActions.sort((a: any, b: any) => {
                        const timeA = new Date(a.runTime || 0).getTime();
                        const timeB = new Date(b.runTime || 0).getTime();
                        return timeA - timeB;
                      });
                    }
                  }
                  
                  updatedSubmissions++;
                } else {
                  // Submission not in our report (possibly from a different time range)
                  console.log(`⚠️ Submission ${submissionId} not found in report, skipping`);
                }
              }
              
            } catch (e) {
              // Skip messages that can't be parsed
              continue;
            }
          }
          
          // Write updated report
          const updatedReportContent = JSON.stringify(reportData, null, 2);
          fs.writeFileSync(reportPath, updatedReportContent);
          
          console.log('');
          console.log('📋 REPORT UPDATED:');
          console.log(`   File: ${reportPath}`);
          console.log(`   Total submissions in report: ${Object.keys(reportData).length}`);
          console.log(`   Submissions updated with actual actions: ${updatedSubmissions}`);
          console.log(`   Size: ${Math.round(updatedReportContent.length / 1024)} KB`);
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
  fetchActualSubmitActionsForForm().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
