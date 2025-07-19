import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

@Controller('chat')
export class ChatManagerController {
  constructor(private readonly chatManagerService: ChatManagerService) {}

  @Post('messages')
  async createMessage(@Body() createMessageDto: CreateMessageDto) {
    return this.chatManagerService.createMessage(createMessageDto);
  }

  @Get('conversations')
  async getConversations(@Query('userId') userId?: string) {
    return this.chatManagerService.getConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatManagerService.getMessages(conversationId, query);
  }

  @Get('conversations/:conversationId/messages/last/:count')
  async getLastMessages(
    @Param('conversationId') conversationId: string,
    @Param('count') count: string,
  ) {
    const messageCount = parseInt(count, 10) || 1;
    return this.chatManagerService.getLastMessages(
      conversationId,
      messageCount,
    );
  }

  @Post('conversations/:conversationId/join')
  async joinConversation(
    @Param('conversationId') conversationId: string,
    @Body() joinRoomDto: JoinRoomDto,
  ) {
    return this.chatManagerService.joinConversation(
      conversationId,
      joinRoomDto,
    );
  }

  @Get('conversations/:conversationId/participants')
  async getParticipants(@Param('conversationId') conversationId: string) {
    return this.chatManagerService.getParticipants(conversationId);
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.chatManagerService.getDashboardStats();
  }

  @Post('conversations/start')
  async startConversation(@Body() startConversationDto: StartConversationDto) {
    return this.chatManagerService.startConversation(startConversationDto);
  }

  @Post('conversations/:conversationId/leave')
  async leaveConversation(
    @Param('conversationId') conversationId: string,
    @Body() data: { userId: string },
  ) {
    const success = await this.chatManagerService.leaveConversation(
      conversationId,
      data.userId,
    );
    return { success, conversationId, userId: data.userId };
  }
}
