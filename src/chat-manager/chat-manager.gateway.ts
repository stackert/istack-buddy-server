import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatManagerService } from './chat-manager.service';
import {
  CreateMessageDto,
  UserRole,
  MessageType,
} from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

@WebSocketGateway({
  cors: {
    origin: true, // TEMPORARY: Allow all origins
    credentials: true,
  },
})
export class ChatManagerGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new CustomLoggerService('ChatManagerGateway');

  constructor(private readonly chatManagerService: ChatManagerService) {
    // Set the gateway reference in the service so it can broadcast messages
    this.chatManagerService.setGateway(this);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: any, // Accept any data structure - we'll normalize it
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.debug('Join room data received', { data });

      if (!data) {
        throw new Error('No data provided');
      }

      // Extract conversationId from data (flexible structure)
      const conversationId = data.conversationId;
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // FUCK IT - CREATE DEFAULT VALUES - stop breaking on missing data
      let joinData: JoinRoomDto;

      if (data.joinData && data.joinData.userId && data.joinData.userRole) {
        // Perfect structure provided
        joinData = data.joinData;
      } else {
        // Use defaults - prioritize getting shit working over perfect structure
        joinData = {
          userId: data.userId || `anonymous_${client.id}`, // Use socket ID as fallback
          userRole: data.userRole || (UserRole.CUSTOMER as any), // Default to customer
        };
        this.logger.debug('Applied default joinData', { joinData });
      }

      await client.join(conversationId);
      const participant = await this.chatManagerService.joinConversation(
        conversationId,
        joinData,
      );

      // Notify others in the room
      client.to(conversationId).emit('user_joined', {
        conversationId,
        participant,
      });

      return { success: true, participant };
    } catch (error) {
      this.logger.error('Error in handleJoinRoom', error);
      return {
        success: false,
        error: error.message || 'Failed to join room',
      };
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { conversationId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { conversationId, userId } = data;
    await client.leave(conversationId);

    // If userId is provided, remove them from conversation participants
    if (userId) {
      await this.chatManagerService.leaveConversation(conversationId, userId);
    }

    client.to(conversationId).emit('user_left', {
      conversationId,
      socketId: client.id,
      userId,
    });

    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Debug logging for message received
    this.logger.debug('WebSocket message received', {
      conversationId: createMessageDto.conversationId,
      fromUserId: createMessageDto.fromUserId,
      fromRole: createMessageDto.fromRole,
      toRole: createMessageDto.toRole,
      messageType: createMessageDto.messageType,
      content:
        createMessageDto.content?.substring(0, 100) +
        (createMessageDto.content?.length > 100 ? '...' : ''),
      clientId: client.id,
    });

    const message =
      await this.chatManagerService.createMessage(createMessageDto);

    // Broadcast message to all users in the conversation
    this.server
      .to(createMessageDto.conversationId)
      .emit('new_message', message);

    // Send to robot if message is to robot
    if (createMessageDto.toRole === 'robot') {
      // Stream robot response and collect full response
      let fullResponse = '';
      console.log(
        `Starting streaming response for conversation: ${createMessageDto.conversationId}`,
      );

      // Create callbacks for robot streaming
      const callbacks = {
        onStreamStart: async (message: any) => {
          console.log('Stream started');
        },
        onStreamChunkReceived: async (chunk: string) => {
          console.log(`Received chunk from robot: "${chunk}"`);
          if (chunk) {
            fullResponse += chunk;
            console.log(
              `Broadcasting chunk to conversation ${createMessageDto.conversationId}: "${chunk}"`,
            );
            // Broadcast each chunk to all clients in the conversation
            this.broadcastToConversation(
              createMessageDto.conversationId,
              'robot_chunk',
              {
                chunk,
              },
            );
            console.log(`Chunk broadcasted successfully`);
          } else {
            console.log(`Received null/empty chunk, skipping`);
          }
        },
        onStreamFinished: async (content: string, authorRole: string) => {
          console.log('Stream finished');
        },
        onFullMessageReceived: async (content: string, authorRole: string) => {
          console.log('Full message received');
        },
        onError: async (error: any) => {
          console.error('Stream error:', error);

          // Create an error message in the conversation
          const errorMessage = await this.chatManagerService.createMessage({
            conversationId: createMessageDto.conversationId,
            fromUserId: 'anthropic-marv-robot',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            messageType: MessageType.TEXT,
            fromRole: UserRole.AGENT,
            toRole: UserRole.CUSTOMER,
          });

          // Broadcast error message to all users in the conversation
          this.server
            .to(createMessageDto.conversationId)
            .emit('new_message', errorMessage);

          // Broadcast error completion
          this.broadcastToConversation(
            createMessageDto.conversationId,
            'robot_complete',
            {
              messageId: errorMessage.id,
            },
          );
        },
      };

      await this.chatManagerService.handleRobotStreamingResponse(
        createMessageDto.conversationId,
        'AnthropicMarv',
        createMessageDto.content,
        callbacks,
      );

      console.log(`Streaming complete. Full response: "${fullResponse}"`);

      if (fullResponse) {
        const robotMessage = await this.chatManagerService.createMessage({
          conversationId: createMessageDto.conversationId,
          fromUserId: 'anthropic-marv-robot',
          content: fullResponse,
          messageType: MessageType.ROBOT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.AGENT,
        });

        // Broadcast robot response to all users in the conversation
        this.server
          .to(createMessageDto.conversationId)
          .emit('new_message', robotMessage);

        // Broadcast completion
        this.broadcastToConversation(
          createMessageDto.conversationId,
          'robot_complete',
          {
            messageId: robotMessage.id,
          },
        );
      }
    }

    return message;
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody()
    data: { conversationId: string; userId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.conversationId).emit('user_typing', {
      userId: data.userId,
      userName: data.userName,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { conversationId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.conversationId).emit('user_typing', {
      userId: data.userId,
      isTyping: false,
    });
  }

  @SubscribeMessage('get_messages')
  async handleGetMessages(
    @MessageBody()
    data: {
      conversationId: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.chatManagerService.getLastMessages(
      data.conversationId,
      data.limit || 50,
    );
  }

  @SubscribeMessage('share_robot_message')
  async handleShareRobotMessage(
    @MessageBody()
    data: {
      originalMessageId: string;
      conversationId: string;
      fromUserId: string;
    },
  ) {
    // This would implement the robot message sharing functionality
    // For now, return a placeholder
    return {
      success: true,
      message: 'Robot message sharing not yet implemented',
    };
  }

  @SubscribeMessage('join_dashboard')
  async handleJoinDashboard(@ConnectedSocket() client: Socket) {
    try {
      this.logger.log(`Client ${client.id} joining dashboard`);
      await client.join('dashboard');
      return { success: true, message: 'Joined dashboard room' };
    } catch (error) {
      this.logger.error('Error joining dashboard', error);
      return { success: false, error: 'Failed to join dashboard' };
    }
  }

  @SubscribeMessage('leave_dashboard')
  async handleLeaveDashboard(@ConnectedSocket() client: Socket) {
    try {
      this.logger.log(`Client ${client.id} leaving dashboard`);
      await client.leave('dashboard');
      return { success: true, message: 'Left dashboard room' };
    } catch (error) {
      this.logger.error('Error leaving dashboard', error);
      return { success: false, error: 'Failed to leave dashboard' };
    }
  }

  // Method to broadcast to specific conversation
  broadcastToConversation(conversationId: string, event: string, data: any) {
    console.log(
      `Gateway: Broadcasting ${event} to conversation ${conversationId}:`,
      data,
    );
    this.server.to(conversationId).emit(event, data);
    console.log(`Gateway: Broadcast completed`);
  }

  // Method to broadcast to dashboard listeners
  broadcastToDashboard(event: string, data: any) {
    this.logger.debug(`Broadcasting dashboard event: ${event}`);
    this.server.to('dashboard').emit(event, data);
  }
}
