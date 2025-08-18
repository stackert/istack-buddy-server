import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('SlackyOpenAiAgent', () => {
  let robot: SlackyOpenAiAgent;

  beforeEach(() => {
    robot = new SlackyOpenAiAgent();
  });

  it('estimates tokens ~ length/4', () => {
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('getUserHelpText returns a formatted help message', () => {
    const help = robot.getUserHelpText();
    expect(help).toContain('iStackBuddy (Slacky OpenAI) - Help');
    expect(help).toContain('What I Can Help With');
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
      'Error in streaming response: OPENAI_API_KEY environment variable is required',
    );

    if (original) process.env.OPENAI_API_KEY = original;
  });
});
