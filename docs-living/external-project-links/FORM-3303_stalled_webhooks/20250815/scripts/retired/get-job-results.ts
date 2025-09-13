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

async function getJobResults(): Promise<void> {
  const jobId = '0D6053F21228BD22';
  
  try {
    console.log('Loading credentials...');
    const credentials = loadSumoCredentials();
    
    // Set up cookie jar for persistent cookies
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    
    // Try messages endpoint (for raw messages as requested)
    const messagesUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}/messages?offset=0&limit=5`;
    
    console.log('=== REQUEST DETAILS ===');
    console.log(`Job ID: ${jobId}`);
    console.log(`URL: ${messagesUrl}`);
    console.log(`Method: GET`);
    console.log(`Using cookie jar: YES`);
    console.log('');
    
    console.log('Getting job messages with cookie support...');
    
    const response = await client.get(messagesUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
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
    
    // If messages fails, try records endpoint as fallback
    if (error.response?.status === 404) {
      console.log('');
      console.log('Trying records endpoint as fallback...');
      
      try {
        const fallbackCredentials = loadSumoCredentials();
        const fallbackAuth = Buffer.from(`${fallbackCredentials.accessId}:${fallbackCredentials.accessKey}`).toString('base64');
        
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));
        const recordsUrl = `${fallbackCredentials.endpoint}/v1/search/jobs/${jobId}/records?offset=0&limit=3`;
        
        console.log(`Records URL: ${recordsUrl}`);
        
        const recordResponse = await client.get(recordsUrl, {
          headers: {
            'Authorization': `Basic ${fallbackAuth}`,
            'Accept': 'application/json'
          }
        });
        
        console.log('=== RECORDS RESPONSE ===');
        console.log(`Status: ${recordResponse.status}`);
        console.log(`Response Data:`);
        console.log(JSON.stringify(recordResponse.data, null, 2));
        
      } catch (recordError: any) {
        console.log('=== RECORDS ERROR ===');
        console.log(`Status Code: ${recordError.response?.status || 'Unknown'}`);
        console.log(`Error Message: ${recordError.message}`);
        if (recordError.response?.data) {
          console.log('Response Data:', JSON.stringify(recordError.response.data, null, 2));
        }
      }
    }
  }
}

if (require.main === module) {
  getJobResults().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
