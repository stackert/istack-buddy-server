import { SlackyAnthropicAgent } from './SlackyAnthropicAgent';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('SlackyAnthropicAgent', () => {
  let robot: SlackyAnthropicAgent;
  beforeEach(() => {
    robot = new SlackyAnthropicAgent();
  });

  it('estimates tokens ~ length/4', () => {
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('getUserHelpText returns a formatted help message', () => {
    const help = robot.getUserHelpText();
    expect(help).toContain('iStackBuddy (Slacky) - Help');
    expect(help).toContain('What I Can Help With');
  });

  it('acceptMessageImmediateResponse rejects when API key missing (getClient throws before try/catch)', async () => {
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

    await expect(
      robot.acceptMessageImmediateResponse(message),
    ).rejects.toThrow();

    if (original) process.env.ANTHROPIC_API_KEY = original;
  });
});
