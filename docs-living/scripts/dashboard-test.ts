#!/usr/bin/env npx ts-node

/**
 * Dashboard Events Test Script
 *
 * Tests all dashboard WebSocket events:
 * - join_dashboard / leave_dashboard
 * - conversation_created
 * - conversation_updated
 * - conversation_participant_added
 * - conversation_participant_removed
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');

console.log('🔄 Starting Dashboard Events Test...\n');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Step 1: Join dashboard to listen for global events
  console.log('\n📊 Step 1: Joining dashboard...');
  socket.emit('join_dashboard');
});

// Listen for dashboard join confirmation
socket.on('join_dashboard', (response: any) => {
  console.log('📊 Dashboard join response:', response);

  if (response.success) {
    console.log(
      '✅ Successfully joined dashboard - listening for global events\n',
    );

    // Step 2: Create a conversation via REST API
    setTimeout(() => createConversation(), 1000);
  }
});

// Listen for dashboard events
socket.on('conversation_created', (data: any) => {
  console.log('🎉 DASHBOARD EVENT: Conversation Created');
  console.log('   Conversation ID:', data.conversation.id);
  console.log('   Created By:', data.createdBy);
  console.log('   Initial Participants:', data.initialParticipants);
  console.log('   Timestamp:', data.timestamp);

  // Step 3: Join the conversation and add a participant
  setTimeout(() => joinConversation(data.conversation.id), 2000);
});

socket.on('conversation_participant_added', (data: any) => {
  console.log('\n👥 DASHBOARD EVENT: Participant Added');
  console.log('   Conversation ID:', data.conversationId);
  console.log(
    '   Participant:',
    data.participant.userId,
    `(${data.participant.userRole})`,
  );
  console.log('   Action:', data.action);
  console.log('   Timestamp:', data.timestamp);

  // Step 4: Send a message to trigger conversation update
  setTimeout(() => sendMessage(data.conversationId), 2000);
});

socket.on('conversation_updated', (data: any) => {
  console.log('\n📝 DASHBOARD EVENT: Conversation Updated');
  console.log('   Conversation ID:', data.conversationId);
  console.log('   Changes:', {
    messageCount: data.changes.messageCount,
    lastMessageAt: new Date(data.changes.lastMessageAt).toLocaleTimeString(),
  });
  console.log('   Timestamp:', data.timestamp);

  // Step 5: Remove participant from conversation
  setTimeout(() => leaveConversation(data.conversationId), 2000);
});

socket.on('conversation_participant_removed', (data: any) => {
  console.log('\n👤 DASHBOARD EVENT: Participant Removed');
  console.log('   Conversation ID:', data.conversationId);
  console.log(
    '   Participant:',
    data.participant.userId,
    `(${data.participant.userRole})`,
  );
  console.log('   Action:', data.action);
  console.log('   Timestamp:', data.timestamp);

  // Step 6: Leave dashboard and exit
  setTimeout(() => {
    console.log('\n📊 Leaving dashboard...');
    socket.emit('leave_dashboard');
    setTimeout(() => {
      console.log('🏁 Dashboard events test completed successfully!');
      socket.disconnect();
      process.exit(0);
    }, 1000);
  }, 2000);
});

// Test functions
let testConversationId = '';

async function createConversation() {
  console.log('🆕 Step 2: Creating conversation via REST API...');

  try {
    const response = await fetch(
      'http://localhost:3500/chat/conversations/start',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createdBy: 'dashboard-test-user',
          createdByRole: 'cx-agent',
          title: 'Dashboard Test Conversation',
          description: 'Testing dashboard events',
          initialParticipants: ['test-participant-1'],
        }),
      },
    );

    const conversation = await response.json();
    testConversationId = conversation.id;
    console.log('✅ Conversation created:', conversation.id);
  } catch (error) {
    console.error('❌ Failed to create conversation:', error);
  }
}

function joinConversation(conversationId: string) {
  console.log('\n👥 Step 3: Adding participant to conversation...');

  socket.emit('join_room', {
    conversationId,
    userId: 'dashboard-test-participant',
    userRole: 'cx-customer',
  });
}

function sendMessage(conversationId: string) {
  console.log('\n📝 Step 4: Sending message to trigger conversation update...');

  socket.emit('send_message', {
    content: 'Dashboard test message',
    conversationId,
    fromUserId: 'dashboard-test-participant',
    fromRole: 'cx-customer',
    toRole: 'cx-agent',
    messageType: 'text',
  });
}

async function leaveConversation(conversationId: string) {
  console.log('\n👤 Step 5: Removing participant from conversation...');

  try {
    const response = await fetch(
      `http://localhost:3500/chat/conversations/${conversationId}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'dashboard-test-participant',
        }),
      },
    );

    const result = await response.json();
    console.log('✅ Participant removed:', result);
  } catch (error) {
    console.error('❌ Failed to remove participant:', error);
  }
}

// Handle errors
socket.on('connect_error', (error: any) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

// Timeout safety
setTimeout(() => {
  console.log('⏰ Test timeout - exiting');
  socket.disconnect();
  process.exit(1);
}, 30000);
