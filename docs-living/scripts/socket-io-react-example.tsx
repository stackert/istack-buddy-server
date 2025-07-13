// React + TypeScript Socket.IO Example
// NOTE: This is a FRONTEND example file - NOT meant to be compiled in the backend
// Copy this to your client project and install these dependencies:
// npm install socket.io-client react @types/react @types/socket.io-client
// @ts-nocheck

import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Type definitions
interface JoinRoomData {
  conversationId: string;
  joinData: {
    userId: string;
    userRole: 'cx-customer' | 'cx-agent' | 'cx-supervisor' | 'robot';
  };
}

interface SendMessageData {
  content: string;
  conversationId: string;
  fromUserId: string;
  fromRole: 'cx-customer' | 'cx-agent' | 'cx-supervisor' | 'robot';
  toRole: 'cx-customer' | 'cx-agent' | 'cx-supervisor' | 'robot';
  messageType?: 'text' | 'system' | 'robot';
}

export function ChatComponent() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      setConnected(true);

      // ✅ CORRECT: Join room with proper data structure
      const joinData: JoinRoomData = {
        conversationId: 'room123',
        joinData: {
          userId: 'user123',
          userRole: 'cx-customer',
        },
      };

      newSocket.emit('join_room', joinData);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnected(false);
    });

    // Listen for join confirmation
    newSocket.on('join_room', (response: any) => {
      console.log('Join room response:', response);
      if (response.success) {
        setMessages((prev) => [...prev, `✅ Successfully joined room`]);
      } else {
        setMessages((prev) => [
          ...prev,
          `❌ Failed to join room: ${response.error}`,
        ]);
      }
    });

    // Listen for user joined events
    newSocket.on('user_joined', (data: any) => {
      console.log('User joined:', data);
      setMessages((prev) => [
        ...prev,
        `📥 ${data.participant.userId} joined the room`,
      ]);
    });

    // Listen for new messages
    newSocket.on('new_message', (message: any) => {
      console.log('New message:', message);
      setMessages((prev) => [
        ...prev,
        `💬 ${message.fromUserId}: ${message.content}`,
      ]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = () => {
    if (!socket || !message.trim()) return;

    const messageData: SendMessageData = {
      content: message,
      conversationId: 'room123',
      fromUserId: 'user123',
      fromRole: 'cx-customer',
      toRole: 'cx-agent',
      messageType: 'text',
    };

    socket.emit('send_message', messageData);
    setMessage('');
  };

  return (
    <div>
      <h2>Chat Room</h2>
      <div>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>

      <div
        style={{
          height: '200px',
          border: '1px solid #ccc',
          padding: '10px',
          overflow: 'auto',
        }}
      >
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage} disabled={!connected}>
          Send
        </button>
      </div>
    </div>
  );
}
