import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  Req, 
  Res, 
  HttpCode, 
  HttpStatus, 
  Logger, 
  UnauthorizedException 
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { isIntentParsingError } from '../common/types/intent-parsing.types';
import { UserRole } from '../chat-manager/dto/create-message.dto';

@Controller('dev-debug')
export class DevDebugChatClientController {
  private readonly logger = new Logger(DevDebugChatClientController.name);

  constructor(
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly chatManagerService: ChatManagerService,
    private readonly intentParsingService: IntentParsingService,
  ) {}

  /**
   * Create a new dev session with temporary user and JWT
   * GET /dev-debug/create-session
   */
  @Get('create-session')
  async createSession(@Res() res: Response): Promise<void> {
    try {
      // Create temporary user and session (same as marv-session pattern)
      const sessionResult = this.authPermissionsService.createDevUserAndSession();
      
      // Set JWT as HTTP-only cookie (8 hours, same as marv)
      res.cookie('dev-jwt', sessionResult.jwtToken, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: 'lax'
      });

      res.status(200).json({
        success: true,
        sessionId: sessionResult.sessionId,
        userId: sessionResult.userId,
        message: 'Dev session created successfully',
        redirectTo: '/dev-debug/monitor'
      });

    } catch (error) {
      this.logger.error('Error creating dev session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dev session',
        message: error.message
      });
    }
  }

  /**
   * Serve the monitor page for watching conversations
   * GET /dev-debug/monitor
   */
  @Get('monitor')
  async serveMonitorPage(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      // Validate JWT cookie
      const jwtToken = req.cookies['dev-jwt'];
      if (!jwtToken) {
        res.redirect('/dev-debug/create-session');
        return;
      }

      const session = this.authPermissionsService.getDevSessionByJwtToken(jwtToken);
      if (!session) {
        res.redirect('/dev-debug/create-session');
        return;
      }

      // Serve monitor HTML page
      const html = this.generateMonitorHtml(session);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      this.logger.error('Error serving monitor page:', error);
      res.status(500).send('Error loading monitor page');
    }
  }

  /**
   * Serve the chat page for a specific conversation
   * GET /dev-debug/chat/:conversationId
   */
  @Get('chat/:conversationId')
  async serveChatPage(
    @Param('conversationId') conversationId: string,
    @Req() req: Request, 
    @Res() res: Response
  ): Promise<void> {
    try {
      // Validate JWT cookie
      const jwtToken = req.cookies['dev-jwt'];
      if (!jwtToken) {
        res.redirect('/dev-debug/create-session');
        return;
      }

      const session = this.authPermissionsService.getDevSessionByJwtToken(jwtToken);
      if (!session) {
        res.redirect('/dev-debug/create-session');
        return;
      }

      // Check if conversation exists
      const conversations = await this.chatManagerService.getConversations();
      const conversation = conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        res.status(404).send(`
          <h1>Conversation Not Found</h1>
          <p>Conversation ${conversationId} does not exist.</p>
          <a href="/dev-debug/monitor">← Back to Monitor</a>
        `);
        return;
      }

      // Serve chat HTML page
      const html = this.generateChatHtml(session, conversation);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      this.logger.error('Error serving chat page:', error);
      res.status(500).send('Error loading chat page');
    }
  }

  /**
   * API: Get conversation list
   * GET /dev-debug/api/conversations
   */
  @Get('api/conversations')
  async getConversations(@Req() req: Request): Promise<any> {
    try {
      const session = this.validateDevSession(req);
      const conversations = await this.chatManagerService.getConversations();
      
      return {
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.id,
          title: conv.id, // Use ID as title for now
          messageCount: conv.messageCount,
          currentRobot: conv.currentRobot || 'none',
          lastActivity: conv.lastMessageAt,
          participants: conv.participantIds.length,
          isActive: conv.isActive
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * API: Get message history for a conversation
   * GET /dev-debug/api/conversation/:id/messages
   */
  @Get('api/conversation/:id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Req() req: Request
  ): Promise<any> {
    try {
      const session = this.validateDevSession(req);
      const messages = await this.chatManagerService.getLastMessages(conversationId, 100);
      
      return {
        success: true,
        conversationId,
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          authorUserId: msg.authorUserId,
          fromRole: msg.fromRole,
          toRole: msg.toRole,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
          // Add debug info for content types
          _debug: {
            contentType: msg.content?.type || 'unknown',
            hasPayload: !!msg.content?.payload,
            payloadLength: msg.content?.payload?.length || 0
          }
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * API: Send a message to a conversation
   * POST /dev-debug/api/conversation/:id/send
   */
  @Post('api/conversation/:id/send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() body: { message: string },
    @Req() req: Request
  ): Promise<any> {
    try {
      const session = this.validateDevSession(req);
      const message = body.message;
      
      if (!message) {
        return { success: false, error: 'Message is required' };
      }

      // Parse intent for debugging
      const intentResult = await this.intentParsingService.parseIntent(message);
      let intentParsing: any = {};
      
      if (!isIntentParsingError(intentResult)) {
        intentParsing = {
          success: true,
          robotName: intentResult.robotName,
          intent: intentResult.intent,
          subIntents: intentResult.intentData.subIntents || [],
          subjects: intentResult.intentData.subjects || {},
          originalUserPrompt: intentResult.intentData.originalUserPrompt
        };
      } else {
        intentParsing = {
          success: false,
          error: intentResult.error,
          reason: intentResult.reason
        };
      }

      // Send message through proper intent parsing pathway WITHOUT callback
      // Let the normal WebSocket system handle robot responses
      const userMessage = await this.chatManagerService.addMessageFromSlack(
        conversationId,
        { type: 'text', payload: message },
        undefined // No callback - use WebSocket broadcasting
      );

      return {
        success: true,
        messageId: userMessage.id,
        conversationId,
        intentParsing,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error sending message:', error);
      return { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate dev session from JWT cookie
   */
  private validateDevSession(req: Request): any {
    const jwtToken = req.cookies['dev-jwt'];
    if (!jwtToken) {
      throw new UnauthorizedException('No dev session found');
    }

    const session = this.authPermissionsService.getDevSessionByJwtToken(jwtToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired dev session');
    }

    return session;
  }

  /**
   * Generate Monitor HTML page
   */
  private generateMonitorHtml(session: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot Router - Conversation Monitor</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .conversation-list { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .conversation-item { border-bottom: 1px solid #eee; padding: 15px 0; cursor: pointer; transition: background 0.2s; }
        .conversation-item:hover { background: #f8f9fa; }
        .conversation-item:last-child { border-bottom: none; }
        .robot-badge { display: inline-block; background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px; }
        .status { font-size: 14px; color: #666; }
        .refresh-btn { background: #17a2b8; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
        .create-btn { background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 20px; margin-left: 10px; }
        .session-info { background: #e9ecef; padding: 10px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; }
        .live-indicator { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Robot Router - Conversation Monitor</h1>
        <p>Real-time monitoring of conversations and robot routing</p>
    </div>
    
    <div class="session-info">
        <strong>Session:</strong> ${session.sessionId.slice(0, 8)}... | 
        <strong>User:</strong> ${session.userId.slice(0, 8)}... | 
        <span class="live-indicator">● LIVE</span>
    </div>
    
    <button class="refresh-btn" onclick="loadConversations()">🔄 Refresh Conversations</button>
    <button class="create-btn" onclick="createNewConversation()">➕ Create New Conversation</button>
    
    <div class="conversation-list">
        <h3>Active Conversations</h3>
        <div id="conversation-list">
            Loading conversations...
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        // Load conversations on page load
        loadConversations();
        
        // Listen for real-time conversation events
        socket.on('conversation_created', (data) => {
            console.log('New conversation:', data);
            loadConversations();
        });
        
        socket.on('conversation_updated', (data) => {
            console.log('Conversation updated:', data);
            loadConversations();
        });
        
        socket.on('conversation_robot_changed', (data) => {
            console.log('Robot changed:', data);
            loadConversations();
        });
        
        async function loadConversations() {
            try {
                const response = await fetch('/dev-debug/api/conversations');
                const data = await response.json();
                
                if (data.success) {
                    displayConversations(data.conversations);
                } else {
                    document.getElementById('conversation-list').innerHTML = 
                        '<p style="color: red;">Error loading conversations: ' + data.error + '</p>';
                }
            } catch (error) {
                document.getElementById('conversation-list').innerHTML = 
                    '<p style="color: red;">Error: ' + error.message + '</p>';
            }
        }
        
        function displayConversations(conversations) {
            const container = document.getElementById('conversation-list');
            
            if (conversations.length === 0) {
                container.innerHTML = '<p>No active conversations</p>';
                return;
            }
            
            container.innerHTML = conversations.map(conv => \`
                <div class="conversation-item" onclick="joinConversation('\${conv.id}')">
                    <strong>📝 \${conv.id.slice(0, 16)}...</strong>
                    <span class="robot-badge">🤖 \${conv.currentRobot}</span>
                    <div class="status">
                        \${conv.messageCount} messages • \${conv.participants} participants • 
                        Last activity: \${new Date(conv.lastActivity).toLocaleTimeString()}
                    </div>
                </div>
            \`).join('');
        }
        
        function joinConversation(conversationId) {
            window.location.href = '/dev-debug/chat/' + conversationId;
        }
        
        async function createNewConversation() {
            try {
                const title = prompt('Conversation title (optional):') || 'New Test Conversation';
                const description = prompt('Description (optional):') || 'Dev client test conversation';
                
                const response = await fetch('/dev-debug/chat-manager/start-conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Immediately join the new conversation
                    window.location.href = '/dev-debug/chat/' + data.conversationId;
                } else {
                    alert('Error creating conversation: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        // Auto-refresh every 30 seconds
        setInterval(loadConversations, 30000);
    </script>
</body>
</html>`;
  }

  /**
   * Generate Chat HTML page
   */
  private generateChatHtml(session: any, conversation: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot Router - Chat: ${conversation.id.slice(0, 16)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .chat-container { display: flex; gap: 20px; height: 70vh; }
        .messages-panel { flex: 2; background: white; border-radius: 8px; padding: 20px; overflow-y: auto; }
        .debug-panel { flex: 1; background: white; border-radius: 8px; padding: 20px; overflow-y: auto; }
        .message { margin-bottom: 15px; padding: 10px; border-radius: 8px; }
        .user-message { background: #e3f2fd; }
        .robot-message { background: #f3e5f5; }
        .streaming { border-left: 3px solid #28a745; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
        .message-header { font-weight: bold; font-size: 12px; color: #666; margin-bottom: 5px; }
        .input-area { background: white; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .input-box { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 4px; resize: vertical; min-height: 60px; }
        .send-btn { background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin-top: 10px; }
        .debug-item { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 14px; }
        .robot-switch { color: #dc3545; font-weight: bold; }
        .robot-processing { background: #fff3cd; border-left: 3px solid #ffc107; }
        .success { background: #d4edda; border-left: 3px solid #28a745; }
        .error { background: #f8d7da; border-left: 3px solid #dc3545; }
        .back-link { color: white; text-decoration: none; padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 4px; }
        .live-indicator { color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>💬 Chat: ${conversation.id.slice(0, 16)}...</h1>
            <p>Current Robot: <strong id="current-robot">${conversation.currentRobot || 'none'}</strong> 
               <span class="live-indicator">● LIVE</span></p>
        </div>
        <a href="/dev-debug/monitor" class="back-link">← Monitor</a>
    </div>
    
    <div class="chat-container">
        <div class="messages-panel">
            <h3>Messages</h3>
            <div id="messages">
                Loading message history...
            </div>
        </div>
        
        <div class="debug-panel">
            <h3>🔍 Debug Info</h3>
            <div id="debug-info">
                <p>Send a message to see intent parsing results...</p>
            </div>
        </div>
    </div>
    
    <div class="input-area">
        <h3>Send Message</h3>
        <textarea id="message-input" class="input-box" placeholder="Type your message here..."></textarea>
        <button class="send-btn" onclick="sendMessage()">Send</button>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const conversationId = '${conversation.id}';
        const userId = '${session.userId}';
        const socket = io();
        
        // Load message history on page load
        loadMessageHistory();
        
        // Join the conversation room for WebSocket events (with proper structure)
        socket.emit('join_room', { 
            conversationId: conversationId,
            userId: userId,
            userRole: 'cx-customer'
        }, (response) => {
            console.log('Join room response:', response);
            if (response && response.success) {
                addDebugInfo('WebSocket', 'Successfully joined conversation room', 'success');
            } else {
                addDebugInfo('WebSocket', 'Failed to join room: ' + (response?.error || 'Unknown error'), 'error');
            }
        });
        console.log('Joining conversation room:', conversationId, 'as user:', userId);
        
        // Debug: Log all WebSocket events
        socket.onAny((eventName, ...args) => {
            console.log('WebSocket event:', eventName, args);
        });
        
        // Listen for new messages (both user and robot messages)
        socket.on('new_message', (data) => {
            console.log('New message received:', data);
            
            // Handle both message formats: direct message or {message, timestamp}
            const message = data.message || data;
            displayMessage(message);
            
            // Display user's own messages immediately (real-time feedback)
            if (message.fromRole === 'cx-customer') {
                addDebugInfo('User Message', 'Your message sent successfully ✅');
            }
        });
        
        // Listen for streaming chunks (real-time robot responses)
        socket.on('robot_chunk', (data) => {
            console.log('Robot chunk received:', data);
            displayStreamingChunk(data.chunk);
            
            // Update debug panel on first chunk (streaming started)
            if (streamingContent === '') {
                addDebugInfo('Streaming', 'Robot response streaming started ⚡', 'robot-processing');
            }
        });
        
        // Listen for robot completion
        socket.on('robot_complete', (data) => {
            console.log('Robot completed:', data);
            completeStreaming();
            
            // Update debug panel
            addDebugInfo('Streaming', 'Robot response completed ✅', 'robot-completed');
        });
        
        // Listen for robot changes
        socket.on('conversation_robot_changed', (data) => {
            if (data.conversationId === conversationId) {
                document.getElementById('current-robot').textContent = data.currentRobot;
                addDebugInfo('Robot Switch', 'Robot changed to: ' + data.currentRobot, 'robot-switch');
            }
        });
        
        async function loadMessageHistory() {
            try {
                const response = await fetch('/dev-debug/api/conversation/' + conversationId + '/messages');
                const data = await response.json();
                
                if (data.success) {
                    const messagesContainer = document.getElementById('messages');
                    messagesContainer.innerHTML = '';
                    
                    // Sort messages by timestamp before displaying
                    data.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    data.messages.forEach(displayMessage);
                } else {
                    document.getElementById('messages').innerHTML = 
                        '<p style="color: red;">Error loading messages: ' + data.error + '</p>';
                }
            } catch (error) {
                document.getElementById('messages').innerHTML = 
                    '<p style="color: red;">Error: ' + error.message + '</p>';
            }
        }
        
        let streamingMessageDiv = null;
        let streamingContent = '';
        
        function displayMessage(message) {
            const messagesContainer = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (message.fromRole === 'cx-customer' ? 'user-message' : 'robot-message');
            
            // Add special styling for different content types
            if (message._debug && message._debug.contentType === 'application/json') {
                messageDiv.style.borderLeft = '4px solid #ffc107';
                messageDiv.style.background = '#fff3cd';
            }
            
            const timeStr = new Date(message.createdAt).toLocaleTimeString();
            const contentType = message._debug ? message._debug.contentType : 'text/plain';
            const payloadLength = message._debug ? message._debug.payloadLength : 0;
            
            let displayContent = message.content.payload || message.content || 'No content';
            
            // Format JSON content for better readability
            if (contentType === 'application/json') {
                try {
                    const parsed = JSON.parse(displayContent);
                    displayContent = \`<pre style="font-size: 12px; max-height: 200px; overflow-y: auto; white-space: pre-wrap;">\${JSON.stringify(parsed, null, 2)}</pre>\`;
                } catch (e) {
                    displayContent = \`<pre style="font-size: 12px;">TOOL RESULT: \${displayContent}</pre>\`;
                }
            }
            
            messageDiv.innerHTML = \`
                <div class="message-header">
                    \${message.fromRole} → \${message.toRole} (\${timeStr})
                    <span style="font-size: 10px; color: #666; margin-left: 10px;">
                        [\${contentType}] \${payloadLength} chars
                    </span>
                </div>
                <div>\${displayContent}</div>
            \`;
            
            messagesContainer.appendChild(messageDiv);
            
            // Auto-scroll to bottom for new messages
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
        
        function displayStreamingChunk(chunk) {
            const messagesContainer = document.getElementById('messages');
            
            // Create streaming message div if it doesn't exist
            if (!streamingMessageDiv) {
                streamingMessageDiv = document.createElement('div');
                streamingMessageDiv.className = 'message robot-message streaming';
                streamingMessageDiv.style.opacity = '0.8';
                streamingMessageDiv.style.borderLeft = '3px solid #28a745';
                
                const timeStr = new Date().toLocaleTimeString();
                streamingMessageDiv.innerHTML = \`
                    <div class="message-header">🤖 robot → cx-customer (\${timeStr}) ⚡ STREAMING</div>
                    <div id="streaming-content"></div>
                \`;
                
                messagesContainer.appendChild(streamingMessageDiv);
                streamingContent = '';
            }
            
            // Append chunk to streaming content
            streamingContent += chunk;
            document.getElementById('streaming-content').innerHTML = streamingContent;
            
            // Auto-scroll to bottom during streaming
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
        
        function completeStreaming() {
            if (streamingMessageDiv) {
                // Mark as completed
                streamingMessageDiv.style.opacity = '1';
                streamingMessageDiv.style.borderLeft = '3px solid #007bff';
                const header = streamingMessageDiv.querySelector('.message-header');
                header.innerHTML = header.innerHTML.replace('⚡ STREAMING', '✅ COMPLETED');
                
                // Reset for next streaming session
                streamingMessageDiv = null;
                streamingContent = '';
            }
        }
        
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            try {
                input.disabled = true;
                
                const response = await fetch('/dev-debug/api/conversation/' + conversationId + '/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: message })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    input.value = '';
                    
                    // Display COMPLETE RAW intent parsing results (for dev/debug)
                    addDebugInfo('FULL INTENT RESULT', \`
                        <pre style="font-size: 11px; max-height: 300px; overflow-y: auto;">\${JSON.stringify(data, null, 2)}</pre>
                    \`);
                    
                    // Show robot processing indicator
                    addDebugInfo('Robot Status', 'Processing message... 🤖⚡', 'robot-processing');
                } else {
                    alert('Error sending message: ' + data.error);
                }
                
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                input.disabled = false;
                input.focus();
            }
        }
        
        function addDebugInfo(title, content, className = '') {
            const debugContainer = document.getElementById('debug-info');
            const debugItem = document.createElement('div');
            debugItem.className = 'debug-item ' + className;
            debugItem.innerHTML = \`
                <strong>\${title}:</strong><br>
                <div>\${content}</div>
                <small>\${new Date().toLocaleTimeString()}</small>
            \`;
            debugContainer.appendChild(debugItem);
            debugContainer.scrollTop = debugContainer.scrollHeight;
        }
        
        // Enter key to send message
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    </script>
</body>
</html>`;
  }
}
