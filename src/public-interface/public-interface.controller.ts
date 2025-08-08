import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
} from '../chat-manager/dto/create-message.dto';
import { AnthropicMarv } from '../robots/AnthropicMarv';
import * as path from 'path';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import { UserProfileService } from '../user-profile/user-profile.service';

@Controller('public')
export class PublicInterfaceController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
    private readonly userProfileService: UserProfileService,
  ) {}

  @Get('/')
  async serveRootContent(@Res() res: Response): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>iStackBuddy Public Interface</title>
</head>
<body>
    <h1>Welcome to iStackBuddy Public Interface</h1>
    <p>This is the public interface for iStackBuddy services.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('/form-marv')
  async handleFormMarvRoot(@Res() res: Response): Promise<void> {
    res.status(404).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/debug-create')
  async createFormMarvSession(
    @Res() res: Response,
    @Req() req: any,
    @Query('formId') formId?: string,
  ): Promise<void> {
    try {
      // Generate a unique user ID for this session
      const userId = `form-marv-temp-${Date.now()}`;

      // Create a temporary user profile for form-marv sessions
      const tempUserProfile = {
        email: `form-marv-${Date.now()}@example.com`,
        username: userId,
        account_type_informal: 'TEMPORARY',
        first_name: 'Form',
        last_name: 'Marv',
      };

      // Let UserProfileService create the user
      this.userProfileService.addTemporaryUser(userId, tempUserProfile);

      // Create a JWT token for the temporary user
      const jwtToken = jwt.sign(
        {
          userId: userId,
          email: tempUserProfile.email,
          username: tempUserProfile.username,
          accountType: 'TEMPORARY',
        },
        'istack-buddy-secret-key-2024',
        { expiresIn: '8h' },
      );

      // Add user to permissions system
      this.authPermissionsService.addUser(
        userId,
        ['cx-agent:form-marv:read', 'cx-agent:form-marv:write'],
        [],
      );

      // Let ChatManagerService create the conversation and generate the conversation ID
      const conversation = await this.chatManagerService.startConversation({
        createdBy: userId,
        createdByRole: UserRole.CUSTOMER,
        title: 'Form Marv Conversation',
        description: `Form Marv conversation for form ${formId || '5375703'}`,
        initialParticipants: [userId],
      });

      // Add debug message to conversation
      try {
        await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: 'form-marv-system',
          content: 'DEBUG - start of conversation',
          messageType: MessageType.SYSTEM,
          fromRole: UserRole.AGENT,
          toRole: UserRole.CUSTOMER,
        });
      } catch (error) {
        console.error('Failed to add debug message:', error);
      }

      const link = `${req.protocol}://${req.get('host')}/public/form-marv/${conversation.id}/${formId || '5375703'}?jwtToken=${jwtToken}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Marv Session Created</title>
</head>
<body>
    <h1>Form Marv Session Created</h1>
    <p><strong>Conversation ID:</strong> ${conversation.id}</p>
    <p><strong>User ID:</strong> ${userId}</p>
    <p><strong>Form ID:</strong> ${formId || '5375703'}</p>
    <p><strong>JWT Token:</strong> ${jwtToken}</p>
    <p><strong>Link:</strong> <a href="${link}">${link}</a></p>
    <p><strong>Chat Messages Endpoint:</strong> ${req.protocol}://${req.get('host')}/public/form-marv/${conversation.id}/${formId || '5375703'}/chat-messages</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Error creating session');
    }
  }

  @Get('/form-marv/:conversationId')
  async serveFormMarvContent(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    // Return 401 for root path - formId is required
    res.status(401).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/:conversationId/:formId')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async serveFormMarvContentWithFormId(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Query('jwtToken') jwtToken: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    try {
      // If JWT token is provided in query, authenticate and set it as a cookie
      if (jwtToken) {
        // Authenticate the user using the authentication service
        const authResult = await this.authService.authenticateUser(
          conversationId,
          jwtToken,
        );

        if (!authResult.success) {
          res.status(401).send('Invalid JWT token');
          return;
        }

        // Set JWT token as cookie
        res.cookie('jwtToken', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Redirect to the same URL without the jwtToken query parameter
        res.redirect(`/public/form-marv/${conversationId}/${formId}`);
        return;
      }

      // For subsequent requests, the JWT token should be in the cookie
      // The AuthPermissionGuard will handle authentication using the cookie
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Forms Marv</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .chat-container { display: flex; gap: 20px; }
        .chat-area { flex: 2; }
        .toolbox { flex: 1; background: #f9f9f9; padding: 15px; border-radius: 5px; }
        .toolbox h3 { margin-top: 0; color: #333; }
        .toolbox-section { margin-bottom: 20px; }
        .toolbox-section h4 { margin-bottom: 10px; color: #666; }
        .tool-button { 
            display: block; 
            width: 100%; 
            padding: 8px 12px; 
            margin: 5px 0; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            background: white; 
            cursor: pointer; 
            text-align: left;
            font-size: 12px;
        }
        .tool-button:hover { background: #e9e9e9; }
        .direct-action { border-left: 4px solid #4CAF50; }
        .template-text { border-left: 4px solid #2196F3; }
        .messages { height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; background: white; }
        .message { margin-bottom: 10px; padding: 8px; border-radius: 4px; }
        .user-message { background: #e3f2fd; margin-left: 20px; }
        .robot-message { background: #f1f8e9; margin-right: 20px; }
        .system-message { background: #fff3e0; font-style: italic; }
        .input-area { display: flex; gap: 10px; }
        .message-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .send-button { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .send-button:hover { background: #45a049; }
        .send-button:disabled { background: #cccccc; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Forms Marv!</h1>
            <p>Your session is active and ready for formId: ${formId}</p>
            <p><strong>Conversation ID:</strong> ${conversationId}</p>
        </div>
        
        <div class="chat-container">
            <div class="chat-area">
                <div class="messages" id="messages">
                    <!-- Messages will be loaded here -->
                </div>
                <div class="input-area">
                    <input type="text" class="message-input" id="messageInput" placeholder="Type your message..." />
                    <button class="send-button" id="sendButton" onclick="sendMessage()">Send</button>
                </div>
            </div>
            
            <div class="toolbox">
                <h3>Marv Toolbox</h3>
                
                <div class="toolbox-section">
                    <h4>Direct Actions (No Input Required)</h4>
                    <button class="tool-button direct-action" onclick="executeDirectAction('formAndRelatedEntityOverview', {formId: '${formId}'})">
                        📊 Get Form Overview
                    </button>
                    <button class="tool-button direct-action" onclick="executeDirectAction('formLogicValidation', {formId: '${formId}'})">
                        🔍 Validate Form Logic
                    </button>
                    <button class="tool-button direct-action" onclick="executeDirectAction('formCalculationValidation', {formId: '${formId}'})">
                        🧮 Validate Calculations
                    </button>
                    <button class="tool-button direct-action" onclick="executeDirectAction('fieldLogicRemove', {formId: '${formId}'})">
                        🗑️ Remove All Logic
                    </button>
                    <button class="tool-button direct-action" onclick="executeDirectAction('fieldLabelUniqueSlugAdd', {formId: '${formId}'})">
                        🏷️ Add Unique Slugs
                    </button>
                    <button class="tool-button direct-action" onclick="executeDirectAction('fieldLabelUniqueSlugRemove', {formId: '${formId}'})">
                        🏷️ Remove Unique Slugs
                    </button>
                </div>
                
                <div class="toolbox-section">
                    <h4>Template Text (Add to Input)</h4>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Create a new form with the following fields:')">
                        📝 Create New Form
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Add a text field to the form')">
                        ➕ Add Text Field
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Add a number field to the form')">
                        ➕ Add Number Field
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Add an email field to the form')">
                        ➕ Add Email Field
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Create a developer copy of this form')">
                        📋 Create Developer Copy
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Create a logic stash for this form')">
                        💾 Create Logic Stash
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Apply the logic stash to this form')">
                        🔄 Apply Logic Stash
                    </button>
                    <button class="tool-button template-text" onclick="addTemplateToInput('Remove field with ID:')">
                        🗑️ Remove Field
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const conversationId = '${conversationId}';
        const formId = '${formId}';
        
        // WebSocket connection
        let socket;
        let robotMessageDiv = null;
        
        // Initialize WebSocket connection
        function initializeWebSocket() {
            // Connect to the existing WebSocket gateway
            socket = io('ws://localhost:3500');
            
            // Join the conversation room
            socket.emit('join_room', {
                conversationId: conversationId,
                joinData: {
                    userId: 'form-marv-user',
                    userRole: 'CUSTOMER'
                }
            });
            
            // Listen for new messages
            socket.on('new_message', (data) => {
                addMessageToUI(data.message.fromUserId, data.message.content);
            });
            
            // Listen for robot streaming chunks
            socket.on('robot_chunk', (data) => {
                if (robotMessageDiv) {
                    robotMessageDiv.textContent += data.chunk;
                    robotMessageDiv.scrollIntoView({ behavior: 'smooth' });
                }
            });
            
            // Listen for robot completion
            socket.on('robot_complete', (data) => {
                robotMessageDiv = null;
                console.log('Robot response complete');
            });
            
            // Listen for user joined/left events
            socket.on('user_joined', (data) => {
                console.log('User joined:', data.participant);
            });
            
            socket.on('user_left', (data) => {
                console.log('User left:', data.userId);
            });
            
            // Handle connection events
            socket.on('connect', () => {
                console.log('Connected to WebSocket');
            });
            
            socket.on('disconnect', () => {
                console.log('Disconnected from WebSocket');
            });
            
            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
            });
        }
        
        // Initialize WebSocket on page load
        initializeWebSocket();
        
        // Load initial messages
        loadMessages();
        
        function loadMessages() {
            fetch(\`/public/form-marv/\${conversationId}/\${formId}/chat-messages\`, {
                credentials: 'include'
            })
            .then(response => response.json())
            .then(messages => {
                const messagesDiv = document.getElementById('messages');
                messagesDiv.innerHTML = '';
                
                messages.forEach(message => {
                    addMessageToUI(message.fromUserId, message.content);
                });
                
                // Scroll to bottom
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            })
            .catch(error => console.error('Error loading messages:', error));
        }
        
        function addMessageToUI(fromUserId, content) {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            
            let className = 'message user-message';
            if (fromUserId === 'anthropic-marv-robot') {
                className = 'message robot-message';
                robotMessageDiv = messageDiv; // Track robot message for streaming
            } else if (fromUserId === 'form-marv-system') {
                className = 'message system-message';
            }
            
            messageDiv.className = className;
            messageDiv.textContent = content;
            messagesDiv.appendChild(messageDiv);
            
            // Scroll to bottom
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            return messageDiv;
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            const sendButton = document.getElementById('sendButton');
            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';
            
            // Add user message to UI immediately
            addMessageToUI('form-marv-user', message);
            input.value = '';
            
            // Create robot message placeholder for streaming
            robotMessageDiv = addMessageToUI('anthropic-marv-robot', '');
            
            // Send message via HTTP (WebSocket will receive the response)
            fetch(\`/public/form-marv/\${conversationId}/\${formId}/chat-messages\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: message })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    alert('Failed to send message');
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
                alert('Error sending message');
            })
            .finally(() => {
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
            });
        }
        
        function executeDirectAction(toolName, params) {
            const message = \`Execute \${toolName} with parameters: \${JSON.stringify(params)}\`;
            document.getElementById('messageInput').value = message;
            sendMessage();
        }
        
        function addTemplateToInput(templateText) {
            const input = document.getElementById('messageInput');
            input.value = templateText;
            input.focus();
        }
        
        // Allow Enter key to send message
        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  @Get('/form-marv/:conversationId/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getChatMessages(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Req() req: any,
    @Query('dtSinceMs') dtSinceMs?: string,
  ): Promise<any[]> {
    try {
      // Get messages from the conversation (conversationId is the conversation ID)
      const messages = await this.chatManagerService.getMessages(
        conversationId,
        {
          limit: 100,
          offset: 0,
        },
      );

      return messages;
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  @Post('/form-marv/:conversationId/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:write')
  async postChatMessage(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Body() messageData: any,
    @Req() req: any,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // A) Add message to conversation
      const userMessage = await this.chatManagerService.addMessage({
        conversationId: conversationId,
        fromUserId: 'form-marv-user',
        content: messageData.content || messageData.message,
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // B) Send to robot (AnthropicMarv)
      const robot =
        this.robotService.getRobotByName<AnthropicMarv>('AnthropicMarv');
      if (robot) {
        const messageEnvelope = {
          messageId: `msg-${Date.now()}`,
          requestOrResponse: 'request' as const,
          envelopePayload: {
            messageId: `msg-${Date.now()}`,
            author_role: 'user',
            content: {
              type: 'text/plain' as const,
              payload: messageData.content || messageData.message,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: 50,
          },
        };

        // Get conversation history for context
        const conversationHistory =
          await this.chatManagerService.getLastMessages(
            conversationId,
            50, // Get last 50 messages for context
          );

        // C) Stream robot response via WebSocket and collect full response
        let fullResponse = '';
        console.log(
          `Starting streaming response for conversation: ${conversationId}`,
        );
        await robot.acceptMessageStreamResponse(
          messageEnvelope,
          {
            onChunkReceived: async (chunk: string) => {
              console.log(`Received chunk from robot: "${chunk}"`);
              if (chunk) {
                fullResponse += chunk;
                console.log(
                  `Broadcasting chunk to conversation ${conversationId}: "${chunk}"`,
                );
                // Broadcast each chunk to all clients in the conversation
                if (this.chatManagerService.getGateway()) {
                  this.chatManagerService
                    .getGateway()
                    .broadcastToConversation(conversationId, 'robot_chunk', {
                      chunk,
                    });
                  console.log(`Chunk broadcasted successfully`);
                } else {
                  console.log(`No gateway available for broadcasting`);
                }
              } else {
                console.log(`Received null/empty chunk, skipping`);
              }
            },
            onStreamStart: (message) => {
              console.log('Stream started');
            },
            onStreamFinished: (message) => {
              console.log('Stream finished');
            },
            onError: (error) => {
              console.error('Stream error:', error);
            },
          },
          () => conversationHistory, // Pass conversation history
        );
        console.log(`Streaming complete. Full response: "${fullResponse}"`);

        // D) Add complete robot response to conversation
        if (fullResponse) {
          const robotMessage = await this.chatManagerService.addMessage({
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',
            content: fullResponse,
            messageType: MessageType.ROBOT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.CUSTOMER,
          });

          // E) Broadcast completion
          if (this.chatManagerService.getGateway()) {
            this.chatManagerService
              .getGateway()
              .broadcastToConversation(conversationId, 'robot_complete', {
                messageId: robotMessage.id,
              });
          }
        }
      }

      return { success: true, messageId: userMessage.id };
    } catch (error) {
      console.error('Error posting chat message:', error);
      return { success: false };
    }
  }
}
