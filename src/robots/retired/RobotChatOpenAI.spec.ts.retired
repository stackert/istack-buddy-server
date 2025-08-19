import { RobotChatOpenAI } from './RobotChatOpenAI';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('RobotChatOpenAI', () => {
  it('estimates tokens ~ length/4', () => {
    const robot = new RobotChatOpenAI();
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('acceptMessageImmediateResponse returns placeholder content', async () => {
    const robot = new RobotChatOpenAI();
    const message: IConversationMessage<TConversationMessageContentString> = {
      id: 'id-1',
      conversationId: 'conv-1',
      authorUserId: 'u1',
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.AGENT,
      messageType: MessageType.TEXT,
      content: { type: 'text/plain', payload: 'Hello' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await robot.acceptMessageImmediateResponse(message);
    expect(result.content.type).toBe('text/plain');
    expect(result.content.payload).toContain('placeholder response');
  });
});
