import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TConversationMessageContent } from '../../ConversationLists/types';

export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ROBOT = 'robot',
}

export enum UserRole {
  USER = 'user', // Replaces CUSTOMER, AGENT, SUPERVISOR
  ROBOT = 'robot', // Unchanged
  SYSTEM = 'system', // Replaces SYSTEM_DEBUG
}

export class CreateMessageDto {
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  content: TConversationMessageContent;

  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  fromUserId: string | null;

  @IsEnum(UserRole)
  fromRole: UserRole;

  @IsEnum(UserRole)
  toRole: UserRole;

  @IsString()
  @IsOptional()
  threadId?: string;

  @IsString()
  @IsOptional()
  originalMessageId?: string;
}
