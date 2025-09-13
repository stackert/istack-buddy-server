import * as dotenv from 'dotenv';
import axios from 'axios';

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

async function createSearchJob(): Promise<void> {
  try {
    console.log('Loading credentials...');
    const credentials = loadSumoCredentials();
    
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    
    // Simple message search query for raw messages
    const query = `_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId" as formId
| json field=_raw "context.submissionId" as submissionId
| limit 20`;

    // 1-hour time range (recent)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));

    // Job creation payload
    const payload = {
      query: query,
      from: oneHourAgo.getTime().toString(),
      to: now.getTime().toString(),
      timeZone: 'America/New_York'
    };
    
    const createJobUrl = `${credentials.endpoint}/v1/search/jobs`;
    
    console.log('=== REQUEST DETAILS ===');
    console.log(`URL: ${createJobUrl}`);
    console.log(`Method: POST`);
    console.log(`Headers: Authorization: Basic [hidden], Content-Type: application/json`);
    console.log(`Payload:`);
    console.log(JSON.stringify(payload, null, 2));
    console.log('');
    
    console.log('Creating search job...');
    
    const response = await axios.post(createJobUrl, payload, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('=== RESPONSE ===');
    console.log(`Status: ${response.status}`);
    console.log(`Response Data:`);
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.log('=== ERROR ===');
    console.log(`Status Code: ${error.response?.status || 'Unknown'}`);
    console.log(`Error Message: ${error.message}`);
    if (error.response?.data) {
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

if (require.main === module) {
  createSearchJob().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
