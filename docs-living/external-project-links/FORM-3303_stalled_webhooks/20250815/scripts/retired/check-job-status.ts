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

async function checkJobStatus(): Promise<void> {
  const jobId = '4B50D2A393CDCD25';
  
  try {
    console.log('Loading credentials...');
    const credentials = loadSumoCredentials();
    
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    const statusUrl = `${credentials.endpoint}/v1/search/jobs/${jobId}`;
    
    console.log(`Checking job: ${jobId}`);
    console.log(`URL: ${statusUrl}`);
    console.log('');
    
    const response = await axios.get(statusUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('=== JOB STATUS ===');
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
  checkJobStatus().catch(error => {
    console.error('Script error:', error.message);
    process.exit(1);
  });
}
