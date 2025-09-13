import * as dotenv from 'dotenv';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

interface SumoLogicCredentials {
  accessId: string;
  accessKey: string;
  endpoint: string;
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

async function completeSumoSearch(): Promise<void> {
  try {
    console.log('🔐 Loading credentials...');
    const credentials = loadSumoCredentials();
    
    // Set up cookie jar for persistent cookies across requests
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    
    // === STEP 1: CREATE SEARCH JOB ===
    console.log('');
    console.log('🚀 STEP 1: Creating search job...');
    
    const query = `_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId" as formId
| json field=_raw "context.submissionId" as submissionId
| limit 100`;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));

    const payload = {
      query: query,
      from: oneHourAgo.getTime().toString(),
      to: now.getTime().toString(),
      timeZone: 'America/New_York'
    };
    
    const createJobUrl = `${credentials.endpoint}/v1/search/jobs`;
    console.log(`📡 POST ${createJobUrl}`);
    
    const createResponse = await client.post(createJobUrl, payload, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    const jobId = createResponse.data.id;
    console.log(`✅ Job created successfully!`);
    console.log(`🆔 Job ID: ${jobId}`);
    
    // === STEP 2: POLL FOR STATUS ===
    console.log('');
    console.log('⏳ STEP 2: Polling for job completion...');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
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
        
        console.log(`📊 Attempt ${attempts}: ${state} (messages: ${messageCount}, records: ${recordCount})`);
        
        if (state === 'DONE GATHERING RESULTS') {
          console.log('🎉 Job completed!');
          
          // === STEP 3: GET RESULTS ===
          console.log('');
          console.log('📋 STEP 3: Getting results...');
          
          try {
            // Try messages first (for raw log data)
            const messagesUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/messages?offset=0&limit=100`;
            console.log(`📨 GET ${messagesUrl}`);
            
            const messageResponse = await client.get(messagesUrl, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            });
            
            console.log('✅ Messages retrieved successfully!');
            console.log('');
            console.log('=== SEARCH RESULTS ===');
            
            if (messageResponse.data.messages && messageResponse.data.messages.length > 0) {
              messageResponse.data.messages.forEach((message: any, index: number) => {
                console.log(`📄 Message ${index + 1}:`);
                console.log(`   Time: ${message.time || 'N/A'}`);
                if (message.map._raw) {
                  // Parse the JSON to show key fields
                  try {
                    const rawData = JSON.parse(message.map._raw);
                    console.log(`   FormID: ${rawData.context?.formId || 'N/A'}`);
                    console.log(`   SubmissionID: ${rawData.context?.submissionId || 'N/A'}`);
                    console.log(`   Message: ${rawData.message || 'N/A'}`);
                  } catch (e) {
                    console.log(`   Raw: ${message.map._raw.substring(0, 100)}...`);
                  }
                } else {
                  console.log(`   Data: ${JSON.stringify(message.map, null, 2)}`);
                }
                console.log('');
              });
              
              console.log(`📊 Total messages: ${messageResponse.data.messages.length}`);
            } else {
              console.log('❌ No messages found.');
            }
            
          } catch (messageError: any) {
            console.log(`❌ Messages failed: ${messageError.response?.status} - ${messageError.response?.data?.message || messageError.message}`);
            
            // Try records as fallback
            try {
              const recordsUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/records?offset=0&limit=100`;
              console.log(`📊 GET ${recordsUrl}`);
              
              const recordResponse = await client.get(recordsUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Accept': 'application/json'
                }
              });
              
              console.log('✅ Records retrieved successfully!');
              console.log('');
              console.log('=== SEARCH RESULTS (RECORDS) ===');
              console.log(JSON.stringify(recordResponse.data, null, 2));
              
            } catch (recordError: any) {
              console.log(`❌ Records also failed: ${recordError.response?.status} - ${recordError.response?.data?.message || recordError.message}`);
            }
          }
          
          return; // Success!
          
        } else if (state === 'CANCELLED' || state.includes('ERROR')) {
          throw new Error(`❌ Search job failed with state: ${state}`);
        }
        
        // Job still running, continue polling
        
      } catch (error: any) {
        console.log(`⚠️ Status check failed: ${error.response?.status} - ${error.message}`);
        // Continue polling
      }
    }
    
    throw new Error('⏰ Search job timed out after 30 seconds');
    
  } catch (error: any) {
    console.log('');
    console.log('💥 ERROR:', error.message);
    if (error.response?.data) {
      console.log('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  completeSumoSearch().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
