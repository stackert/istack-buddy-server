#!/usr/bin/env npx ts-node

/**
 * Simple Robot Test for Form Overview Tool
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Join room
  socket.emit('join_room', {
    conversationId: 'debug-conv-robot-integration-001',
    userId: 'test-user-simple',
    userRole: 'cx-agent',
  });

  // Send form request to trigger tool execution
  setTimeout(() => {
    console.log('📤 Sending form tool request...');
    socket.emit('send_message', {
      content: 'Please analyze @robot formId: 5375703',
      conversationId: 'debug-conv-robot-integration-001',
      fromUserId: 'test-user-simple',
      fromRole: 'cx-agent',
      toRole: 'robot',
      messageType: 'text',
    });
  }, 1000);
});

// Listen for responses
socket.on('new_message', (message: any) => {
  console.log('📥 Received message:');
  console.log('From:', message.fromUserId, message.fromRole);
  console.log('Content length:', message.content.length);
  console.log('Content preview:', message.content.substring(0, 200));
  console.log('---');
});

// Exit after timeout
setTimeout(() => {
  console.log('⏰ Test timeout - exiting');
  socket.disconnect();
  process.exit(0);
}, 20000);
