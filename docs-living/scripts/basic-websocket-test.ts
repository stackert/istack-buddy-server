#!/usr/bin/env npx ts-node

/**
 * Basic WebSocket Test
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Test a known working event
  console.log('🏠 Testing join_room...');
  socket.emit('join_room', {
    conversationId: 'test-room',
    userId: 'test-user',
    userRole: 'cx-customer',
  });
});

// Listen for any events
socket.onAny((event, ...args) => {
  console.log('📡 Received event:', event);
  console.log('📄 Data:', JSON.stringify(args, null, 2));

  if (event === 'join_room') {
    // Now test dashboard after we know WebSocket is working
    console.log('\n📊 Testing join_dashboard...');
    socket.emit('join_dashboard');
  }

  if (event === 'join_dashboard') {
    console.log('✅ Dashboard join worked!');
    socket.disconnect();
    process.exit(0);
  }
});

socket.on('disconnect', () => {
  console.log('👋 Disconnected');
});

// Exit after 10 seconds
setTimeout(() => {
  console.log('⏰ Timeout');
  socket.disconnect();
  process.exit(1);
}, 10000);
