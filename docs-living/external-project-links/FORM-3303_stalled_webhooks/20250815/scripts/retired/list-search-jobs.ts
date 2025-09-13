import * as dotenv from 'dotenv';
import axios from 'axios';

interface SumoLogicCredentials {
  accessId: string;
  accessKey: string;
  endpoint: string;
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

async function getCurrentUser(credentials: SumoLogicCredentials, auth: string): Promise<any> {
  try {
    const userUrl = `${credentials.endpoint}/v1/users/me`;
    console.log(`Getting current user info from: ${userUrl}`);
    
    const response = await axios.get(userUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error getting user info:', error.message);
    return null;
  }
}

async function listSearchJobs(): Promise<void> {
  try {
    console.log('Loading Sumo Logic credentials...');
    const credentials = loadSumoCredentials();
    
    const auth = Buffer.from(`${credentials.accessId}:${credentials.accessKey}`).toString('base64');
    
    // Get all searches
    const listJobsUrl = `${credentials.endpoint}/v1/logSearches`;
    console.log(`Getting all log searches from: ${listJobsUrl}`);
    
    const response = await axios.get(listJobsUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    // Handle different response structures
    const allSearches = Array.isArray(response.data) ? response.data : 
                       response.data.data ? response.data.data : 
                       response.data.logSearches || [];
    
    console.log(`Total searches in organization: ${allSearches.length}`);
    console.log('');
    
    // Group searches by creator
    const searchesByCreator = new Map<string, any[]>();
    
    allSearches.forEach((search: any) => {
      const creatorId = search.createdBy || 'Unknown';
      if (!searchesByCreator.has(creatorId)) {
        searchesByCreator.set(creatorId, []);
      }
      searchesByCreator.get(creatorId)!.push(search);
    });
    
    console.log('=== SEARCHES BY CREATOR ===');
    console.log('');
    
    // Sort creators by number of searches (descending)
    const sortedCreators = Array.from(searchesByCreator.entries())
      .sort(([,a], [,b]) => b.length - a.length);
    
    sortedCreators.forEach(([creatorId, searches]) => {
      console.log(`📁 Creator ID: ${creatorId} (${searches.length} searches)`);
      
      searches.forEach((search: any, index: number) => {
        console.log(`   ${index + 1}. ${search.name}`);
        console.log(`      ID: ${search.id}`);
        console.log(`      Created: ${search.createdAt}`);
        if (search.description) {
          console.log(`      Description: ${search.description.substring(0, 100)}${search.description.length > 100 ? '...' : ''}`);
        }
        console.log('');
      });
      console.log('---');
      console.log('');
    });
    
    console.log('💡 To identify which searches are yours, look for:');
    console.log('   - Searches with names/descriptions you recognize');
    console.log('   - Recent creation dates that match when you created them');
    console.log('   - One creator ID will likely have most of "your" searches');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  listSearchJobs().catch(error => {
    console.error('Unhandled error:', error.message);
    process.exit(1);
  });
}
