import axios from 'axios';

const BASE_URL = 'http://localhost:3500';

async function checkConversations() {
  try {
    console.log('Checking all conversations...');

    // Note: This endpoint requires authentication and permissions
    // You may need to add proper auth headers or use a different approach
    const response = await axios.get(`${BASE_URL}/chat/conversations`, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
        // 'Authorization': 'Bearer your-jwt-token'
      },
    });

    console.log('All conversations:', response.data);

    if (Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} conversations:`);
      response.data.forEach((conv: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${conv.id}`);
        console.log(
          `     Participants: ${conv.participantIds?.join(', ') || 'none'}`,
        );
        console.log(`     Message Count: ${conv.messageCount || 0}`);
        console.log(`     Last Message: ${conv.lastMessageAt || 'never'}`);
        console.log(`     Active: ${conv.isActive || false}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error('Error checking conversations:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function main() {
  await checkConversations();
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkConversations };
