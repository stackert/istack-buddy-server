#!/usr/bin/env npx ts-node

/**
 * Conversation Lifecycle Test Script
 *
 * Creates new conversations every 3 seconds and removes them every 3 seconds
 * (on separate cycles) to test dashboard events continuously.
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');
const BASE_URL = 'http://localhost:3500';

// Track created conversations for cleanup
const activeConversations: string[] = [];
let conversationCounter = 0;

console.log('🔄 Starting Conversation Lifecycle Test...\n');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('📊 Joining dashboard to monitor events...\n');

  // Join dashboard to monitor events
  socket.emit('join_dashboard');

  // Start the creation cycle immediately
  startCreationCycle();

  // Start the deletion cycle after 1.5 seconds (offset)
  setTimeout(() => {
    startDeletionCycle();
  }, 1500);
});

// Listen for dashboard events
socket.on('conversation_created', (data: any) => {
  console.log(`🎉 DASHBOARD EVENT: Conversation Created`);
  console.log(`   ID: ${data.conversation.id}`);
  console.log(`   Created by: ${data.createdBy}`);
  console.log(`   Participants: ${data.initialParticipants.length}`);
  console.log(`   Timestamp: ${data.timestamp}\n`);
});

socket.on('conversation_participant_added', (data: any) => {
  console.log(`➕ DASHBOARD EVENT: Participant Added`);
  console.log(`   Conversation: ${data.conversationId}`);
  console.log(`   User: ${data.participant.userId}`);
  console.log(`   Role: ${data.participant.userRole}\n`);
});

socket.on('conversation_participant_removed', (data: any) => {
  console.log(`➖ DASHBOARD EVENT: Participant Removed`);
  console.log(`   Conversation: ${data.conversationId}`);
  console.log(`   User: ${data.participant.userId}`);
  console.log(`   Role: ${data.participant.userRole}\n`);
});

socket.on('conversation_updated', (data: any) => {
  console.log(`📝 DASHBOARD EVENT: Conversation Updated`);
  console.log(`   ID: ${data.conversationId}`);
  console.log(`   Message Count: ${data.changes.messageCount}`);
  console.log(`   Last Activity: ${data.changes.lastMessageAt}\n`);
});

function startCreationCycle() {
  console.log('🚀 Starting conversation creation cycle (every 3 seconds)...\n');

  // Create immediately, then every 3 seconds
  createConversation();
  setInterval(() => {
    createConversation();
  }, 3000);
}

function startDeletionCycle() {
  console.log(
    '🗑️  Starting conversation deletion cycle (every 3 seconds, offset by 1.5s)...\n',
  );

  setInterval(() => {
    deleteConversation();
  }, 3000);
}

async function createConversation() {
  try {
    conversationCounter++;
    const conversationData = {
      createdBy: `test-user-${conversationCounter}`,
      createdByRole: 'cx-customer',
      title: `Test Conversation ${conversationCounter}`,
      description: `Auto-generated test conversation created at ${new Date().toISOString()}`,
      initialParticipants: [
        {
          userId: `test-user-${conversationCounter}`,
          userRole: 'cx-customer',
        },
      ],
    };

    console.log(`📝 Creating conversation ${conversationCounter}...`);

    const response = await fetch(`${BASE_URL}/chat/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(conversationData),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create conversation: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    activeConversations.push(result.id);

    console.log(`✅ Created conversation: ${result.id}`);
    console.log(`   Active conversations: ${activeConversations.length}\n`);
  } catch (error) {
    console.error('❌ Error creating conversation:', error.message);
  }
}

async function deleteConversation() {
  if (activeConversations.length === 0) {
    console.log('⚠️  No active conversations to delete\n');
    return;
  }

  try {
    // Remove the oldest conversation
    const conversationId = activeConversations.shift();
    console.log(`🗑️  Deleting conversation: ${conversationId}...`);

    // First, try to leave the conversation (this will trigger participant_removed event)
    const leaveResponse = await fetch(
      `${BASE_URL}/chat/conversations/${conversationId}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user-cleanup',
        }),
      },
    );

    if (leaveResponse.ok) {
      console.log(`✅ Successfully removed conversation: ${conversationId}`);
      console.log(`   Active conversations: ${activeConversations.length}\n`);
    } else {
      console.log(
        `⚠️  Leave response: ${leaveResponse.status} - ${conversationId} may not have had participants to remove\n`,
      );
    }
  } catch (error) {
    console.error('❌ Error deleting conversation:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  console.log(
    `📊 Final stats: ${activeConversations.length} conversations still active`,
  );
  socket.disconnect();
  process.exit(0);
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error);
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Disconnected: ${reason}`);
});

console.log('💡 Press Ctrl+C to stop the test\n');
