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

export enum ConversationParticipantRole {
  CX_AGENT = 'cx:agent',
  CX_SUPERVISOR = 'cx:supervisor',
  CX_CUSTOMER = 'cx:customer',
  SYSTEM = 'system',
  ROBOT_ALL = 'robot:all',
  SYSTEM_DEBUG = 'system:debug',
  SYSTEM_CONVERSATION_MANAGER = 'system:conversation:manager',
  VISIBLE_TO_ALL = 'visible-to-all',
}

export enum RobotName {
  AGENT_ROBOT_PARROT = 'AgentRobotParrot',
  SLACKY_OPENAI_AGENT = 'SlackyOpenAiAgent',
  ANTHROPIC_MARV = 'AnthropicMarv',
  KNOBBY_OPENAI_SEARCH = 'KnobbyOpenAiSearch',
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

  @IsEnum(ConversationParticipantRole, { each: true })
  @IsOptional()
  participantVisibility?: ConversationParticipantRole[];

  @IsEnum(ConversationParticipantRole, { each: true })
  @IsOptional()
  intendedVisibility?: ConversationParticipantRole[];
}
