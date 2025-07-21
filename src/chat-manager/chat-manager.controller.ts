import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@Controller('chat')
@UseGuards(AuthPermissionGuard)
export class ChatManagerController {
  constructor(private readonly chatManagerService: ChatManagerService) {}

  @Post('messages')
  @RequirePermissions('chat:conversations:message:create')
  async createMessage(@Body() createMessageDto: CreateMessageDto) {
    return this.chatManagerService.createMessage(createMessageDto);
  }

  @Get('conversations')
  @RequirePermissions('chat:conversations:read')
  async getConversations(@Query('userId') userId?: string) {
    return this.chatManagerService.getConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  @RequirePermissions('chat:conversations:message:read')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatManagerService.getMessages(conversationId, query);
  }

  @Get('conversations/:conversationId/messages/last/:count')
  @RequirePermissions('chat:conversations:message:read')
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
  @RequirePermissions('chat:conversations:update')
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
  @RequirePermissions('chat:conversations:read')
  async getParticipants(@Param('conversationId') conversationId: string) {
    return this.chatManagerService.getParticipants(conversationId);
  }

  @Get('dashboard/stats')
  @RequirePermissions('chat:dashboard:stats')
  async getDashboardStats() {
    return this.chatManagerService.getDashboardStats();
  }

  @Post('conversations/start')
  @RequirePermissions('chat:conversations:create')
  async startConversation(@Body() startConversationDto: StartConversationDto) {
    return this.chatManagerService.startConversation(startConversationDto);
  }

  @Post('conversations/:conversationId/leave')
  @RequirePermissions('chat:conversations:update')
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
