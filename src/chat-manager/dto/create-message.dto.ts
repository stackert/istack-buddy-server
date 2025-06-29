import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ROBOT = 'robot',
}

export enum UserRole {
  CUSTOMER = 'cx-customer',
  AGENT = 'cx-agent',
  SUPERVISOR = 'cx-supervisor',
  ROBOT = 'robot',
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  fromUserId: string;

  @IsEnum(UserRole)
  fromRole: UserRole;

  @IsEnum(UserRole)
  toRole: UserRole;

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT;

  @IsString()
  @IsOptional()
  threadId?: string;

  @IsString()
  @IsOptional()
  originalMessageId?: string;
}
