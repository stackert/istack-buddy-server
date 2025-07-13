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
import { CreateMessageDto, UserRole } from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';

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

  constructor(private readonly chatManagerService: ChatManagerService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: any, // Accept any data structure - we'll normalize it
    @ConnectedSocket() client: Socket,
  ) {
    try {
      console.log('Join room data received:', JSON.stringify(data, null, 2));

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
        console.log('Applied default joinData:', joinData);
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
      console.error('Error in handleJoinRoom:', error);
      return {
        success: false,
        error: error.message || 'Failed to join room',
      };
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { conversationId } = data;
    await client.leave(conversationId);

    client.to(conversationId).emit('user_left', {
      conversationId,
      socketId: client.id,
    });

    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const message =
      await this.chatManagerService.createMessage(createMessageDto);

    // Broadcast message to all users in the conversation
    this.server
      .to(createMessageDto.conversationId)
      .emit('new_message', message);

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

  // Method to broadcast to specific conversation
  broadcastToConversation(conversationId: string, event: string, data: any) {
    this.server.to(conversationId).emit(event, data);
  }
}
