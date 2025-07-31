#!/usr/bin/env npx ts-node

/**
 * Simple Dashboard Test
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('✅ Connected to server');

  // Test join_dashboard
  console.log('📊 Emitting join_dashboard...');
  socket.emit('join_dashboard');
});

socket.on('join_dashboard', (response: any) => {
  console.log('📊 Dashboard join response:', response);
  socket.disconnect();
  process.exit(0);
});

// Listen for any events
socket.onAny((event, ...args) => {
  console.log('📡 Received event:', event, args);
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
