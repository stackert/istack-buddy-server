import { MarvOpenAiAgent } from './MarvOpenAiAgent';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('MarvOpenAiAgent', () => {
  let robot: MarvOpenAiAgent;

  beforeEach(() => {
    robot = new MarvOpenAiAgent();
  });

  it('estimates tokens ~ length/4', () => {
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('acceptMessageImmediateResponse returns error message when API key missing', async () => {
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

    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await robot.acceptMessageImmediateResponse(message);
    expect(result.content.type).toBe('text/plain');
    expect(result.content.payload).toContain(
      'I apologize, but I encountered an error',
    );

    if (original) process.env.OPENAI_API_KEY = original;
  });
});
