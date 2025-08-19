import { RobotChatAnthropic } from './RobotChatAnthropic';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('RobotChatAnthropic', () => {
  let robot: RobotChatAnthropic;

  beforeEach(() => {
    robot = new RobotChatAnthropic();
  });

  it('estimates tokens ~ length/4', () => {
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('setConversationHistory and immediate response error path without API key', async () => {
    const history: IConversationMessage[] = [
      {
        id: 'h1',
        conversationId: 'conv1',
        authorUserId: 'u1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        content: { type: 'text/plain', payload: 'Prev message' } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    robot.setConversationHistory(history);

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

    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await robot.acceptMessageImmediateResponse(message);
    expect(result.content.type).toBe('text/plain');
    expect(result.content.payload).toContain(
      'I apologize, but I encountered an error',
    );

    if (original) process.env.ANTHROPIC_API_KEY = original;
  });
});
