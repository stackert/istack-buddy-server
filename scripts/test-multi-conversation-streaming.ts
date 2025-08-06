import { io } from 'socket.io-client';

// Test configuration
const BASE_URL = 'http://localhost:3500';
const CONVERSATION_IDS = ['test-conv-1', 'test-conv-2', 'test-conv-3'];

interface TestClient {
  id: string;
  socket: any;
  conversationId: string;
  messages: string[];
}

class MultiConversationTester {
  private clients: TestClient[] = [];

  async createClient(
    clientId: string,
    conversationId: string,
  ): Promise<TestClient> {
    const socket = io(BASE_URL);

    return new Promise((resolve) => {
      socket.on('connect', () => {
        console.log(`Client ${clientId} connected`);

        // Join the conversation
        socket.emit('join_room', {
          conversationId: conversationId,
          joinData: {
            userId: `user-${clientId}`,
            userRole: 'CUSTOMER',
          },
        });

        const client: TestClient = {
          id: clientId,
          socket,
          conversationId,
          messages: [],
        };

        // Listen for messages
        socket.on('new_message', (data) => {
          console.log(
            `Client ${clientId} received message:`,
            data.message.content,
          );
          client.messages.push(data.message.content);
        });

        socket.on('robot_chunk', (data) => {
          console.log(`Client ${clientId} received robot chunk:`, data.chunk);
        });

        socket.on('robot_complete', (data) => {
          console.log(`Client ${clientId} received robot complete:`, data);
        });

        resolve(client);
      });
    });
  }

  async sendMessage(client: TestClient, message: string) {
    return new Promise((resolve) => {
      client.socket.emit('send_message', {
        conversationId: client.conversationId,
        fromUserId: `user-${client.id}`,
        fromRole: 'CUSTOMER',
        toRole: 'robot',
        messageType: 'text',
        content: message,
      });

      // Wait a bit for response
      setTimeout(resolve, 3000);
    });
  }

  async testMultiParticipant() {
    console.log('\n=== Testing Multi-Participant Scenario ===');

    // Create 3 clients for the same conversation
    const conversationId = CONVERSATION_IDS[0];

    const client1 = await this.createClient('participant-1', conversationId);
    const client2 = await this.createClient('participant-2', conversationId);
    const client3 = await this.createClient('participant-3', conversationId);

    this.clients = [client1, client2, client3];

    console.log('All participants joined conversation:', conversationId);

    // Send messages from different participants
    await this.sendMessage(client1, 'Hello from participant 1');
    await this.sendMessage(client2, 'Hello from participant 2');
    await this.sendMessage(client3, 'Hello from participant 3');

    console.log('\nMulti-participant test completed');
    console.log('Client 1 messages:', client1.messages);
    console.log('Client 2 messages:', client2.messages);
    console.log('Client 3 messages:', client3.messages);
  }

  async testMultiConversation() {
    console.log('\n=== Testing Multi-Conversation Scenario ===');

    // Create 1 client for each conversation
    const client1 = await this.createClient('user-1', CONVERSATION_IDS[0]);
    const client2 = await this.createClient('user-2', CONVERSATION_IDS[1]);
    const client3 = await this.createClient('user-3', CONVERSATION_IDS[2]);

    this.clients = [client1, client2, client3];

    console.log('Users joined different conversations');

    // Send messages simultaneously in different conversations
    await Promise.all([
      this.sendMessage(client1, 'Message in conversation 1'),
      this.sendMessage(client2, 'Message in conversation 2'),
      this.sendMessage(client3, 'Message in conversation 3'),
    ]);

    console.log('\nMulti-conversation test completed');
    console.log('Conversation 1 messages:', client1.messages);
    console.log('Conversation 2 messages:', client2.messages);
    console.log('Conversation 3 messages:', client3.messages);
  }

  async cleanup() {
    console.log('\nCleaning up connections...');
    for (const client of this.clients) {
      client.socket.disconnect();
    }
    console.log('All connections closed');
  }

  async runAllTests() {
    try {
      await this.testMultiParticipant();
      await this.testMultiConversation();
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
async function main() {
  console.log('Starting multi-conversation streaming tests...');

  const tester = new MultiConversationTester();
  await tester.runAllTests();

  console.log('\nAll tests completed!');
}

if (require.main === module) {
  main().catch(console.error);
}

export { MultiConversationTester };
