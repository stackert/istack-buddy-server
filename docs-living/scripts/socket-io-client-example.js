// Socket.IO Client Example - Correct Usage
// npm install socket.io-client

const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  withCredentials: true,
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to server');

  // ✅ CORRECT: Join room with proper data structure
  socket.emit('join_room', {
    conversationId: 'room123',
    joinData: {
      userId: 'user123',
      userRole: 'cx-customer', // Valid values: 'cx-customer', 'cx-agent', 'cx-supervisor', 'robot'
    },
  });
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// Listen for join confirmation
socket.on('join_room', (response) => {
  console.log('Join room response:', response);
});

// Listen for user joined events
socket.on('user_joined', (data) => {
  console.log('User joined:', data);
});

// Listen for new messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Send a message
function sendMessage(content) {
  socket.emit('send_message', {
    content: content,
    conversationId: 'room123',
    fromUserId: 'user123',
    fromRole: 'cx-customer',
    toRole: 'cx-agent',
    messageType: 'text',
  });
}

// Example usage
setTimeout(() => {
  sendMessage('Hello from client!');
}, 2000);
