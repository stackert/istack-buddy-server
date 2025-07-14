#!/usr/bin/env npx ts-node

/**
 * Robot Response Test Script
 *
 * Usage: npx ts-node docs-living/scripts/robot-test.ts
 *
 * What it does:
 * 1. Connects to WebSocket server on localhost:3001
 * 2. Joins a test conversation
 * 3. Sends a message with @robot prefix
 * 4. Waits for robot response(s)
 * 5. Tests both simple and form-based robot messages
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

let messagesReceived = 0;
let expectedMessages = 2; // Original message + robot response

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Join room (server will use defaults for missing data)
  socket.emit('join_room', {
    conversationId: 'debug-conv-robot-integration-001',
    userId: 'test-user-robot',
    userRole: 'cx-agent',
  });

  // Test 1: Simple robot message (should use ChatRobotParrot)
  setTimeout(() => {
    console.log('📤 Sending simple robot test message...');
    socket.emit('send_message', {
      content: 'Hello from test script! @robot Please echo this back.',
      conversationId: 'debug-conv-robot-integration-001',
      fromUserId: 'test-user-robot',
      fromRole: 'cx-agent',
      toRole: 'robot',
      messageType: 'text',
    });
    console.log('📤 Simple robot message sent, waiting for response...');
  }, 1000);

  // Test 2: Form-based robot message (should use RobotChatAnthropic)
  setTimeout(() => {
    console.log('📤 Sending form-based robot test message...');
    expectedMessages += 2; // Form requests create additional messages
    socket.emit('send_message', {
      content:
        'Can you help me with this form? @robot Please analyze formId: 123456',
      conversationId: 'debug-conv-robot-integration-001',
      fromUserId: 'test-user-robot',
      fromRole: 'cx-agent',
      toRole: 'robot',
      messageType: 'text',
    });
    console.log('📤 Form robot message sent, waiting for response...');
  }, 3000);
});

// Listen for message responses
socket.on('new_message', (message: any) => {
  messagesReceived++;
  console.log(`📥 Received message ${messagesReceived}:`, {
    id: message.id,
    fromUserId: message.fromUserId,
    fromRole: message.fromRole,
    toRole: message.toRole,
    messageType: message.messageType,
    content:
      message.content.substring(0, 100) +
      (message.content.length > 100 ? '...' : ''),
  });

  if (messagesReceived >= expectedMessages) {
    console.log('🏁 All expected messages received - test complete!');
    socket.disconnect();
    process.exit(0);
  }
});

// Handle connection errors
socket.on('connect_error', (error: any) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('👋 Disconnected from server');
});

// Exit after 15 seconds if not all responses received
setTimeout(() => {
  console.log(
    `⏰ Timeout - received ${messagesReceived}/${expectedMessages} messages`,
  );
  socket.disconnect();
  process.exit(1);
}, 15000);
