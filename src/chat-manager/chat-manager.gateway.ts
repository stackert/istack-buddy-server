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
import { CreateMessageDto } from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
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
    @MessageBody() data: { conversationId: string; joinData: JoinRoomDto },
    @ConnectedSocket() client: Socket,
  ) {
    const { conversationId, joinData } = data;

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
