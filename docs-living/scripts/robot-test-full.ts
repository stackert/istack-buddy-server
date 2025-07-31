#!/usr/bin/env npx ts-node

/**
 * Full Robot Response Test - shows complete content
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Join room
  socket.emit('join_room', {
    conversationId: 'debug-conv-robot-integration-001',
    userId: 'test-user-full',
    userRole: 'cx-agent',
  });

  // Send form request to trigger tool execution
  setTimeout(() => {
    console.log('📤 Sending form tool request...');
    socket.emit('send_message', {
      content: 'Please analyze @robot formId: 5375703',
      conversationId: 'debug-conv-robot-integration-001',
      fromUserId: 'test-user-full',
      fromRole: 'cx-agent',
      toRole: 'robot',
      messageType: 'text',
    });
  }, 1000);
});

let messageCount = 0;

// Listen for responses
socket.on('new_message', (message: any) => {
  messageCount++;
  console.log(`\n========== MESSAGE ${messageCount} ==========`);
  console.log('From:', message.fromUserId, `(${message.fromRole})`);
  console.log('To:', message.toRole || 'N/A');
  console.log('Type:', message.messageType);
  console.log('Length:', message.content.length, 'characters');
  console.log('\n--- FULL CONTENT ---');
  console.log(message.content);
  console.log('--- END CONTENT ---\n');
});

// Exit after timeout
setTimeout(() => {
  console.log(`\n⏰ Test complete - received ${messageCount} messages`);
  socket.disconnect();
  process.exit(0);
}, 15000);
