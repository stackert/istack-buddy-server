#!/usr/bin/env npx ts-node

/**
 * Minimal Socket.IO Chat Test
 *
 * Usage: npx ts-node docs-living/scripts/simple-chat-test.ts
 *
 * What it does:
 * 1. Connects to WebSocket server on localhost:3500
 * 2. Joins a test room
 * 3. Sends a message
 * 4. Waits for echo response
 * 5. Exits when done
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Join room (server will use defaults for missing data)
  socket.emit('join_room', {
    conversationId: 'test-room-123',
  });

  // Send message after short delay (don't wait for join confirmation)
  setTimeout(() => {
    console.log('📤 Sending test message...');
    socket.emit('send_message', {
      content: 'Hello from test script! Please echo this back.',
      conversationId: 'test-room-123',
      fromUserId: 'test-user',
      fromRole: 'cx-customer',
      toRole: 'robot',
      messageType: 'text',
    });
    console.log('📤 Message sent, waiting for response...');
  }, 1000);
});

// Listen for message responses
socket.on('new_message', (message: any) => {
  console.log('📥 Received message:', message.content);
  console.log('🏁 Test complete - exiting');
  socket.disconnect();
  process.exit(0);
});

// Handle connection errors
socket.on('connect_error', (error: any) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('👋 Disconnected from server');
});

// Exit after 10 seconds if no response
setTimeout(() => {
  console.log('⏰ Timeout - no response received');
  socket.disconnect();
  process.exit(1);
}, 10000);
