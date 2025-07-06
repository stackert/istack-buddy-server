import { RobotChatAnthropicToolSet } from './RobotChatAnthropicTools';
import type { TAnthropicIstackToolSet } from './slacky';

describe('RobotChatAnthropicToolSet (Backward Compatibility)', () => {
  it('should export a tool set with correct structure', () => {
    expect(RobotChatAnthropicToolSet).toBeDefined();
    expect(RobotChatAnthropicToolSet).toHaveProperty('toolDefinitions');
    expect(RobotChatAnthropicToolSet).toHaveProperty('executeToolCall');
  });

  it('should have the correct type', () => {
    const toolSet: TAnthropicIstackToolSet = RobotChatAnthropicToolSet;
    expect(toolSet).toBeDefined();
  });

  it('should have 3 tool definitions', () => {
    expect(RobotChatAnthropicToolSet.toolDefinitions).toHaveLength(3);
  });

  it('should have the expected tool names', () => {
    const toolNames = RobotChatAnthropicToolSet.toolDefinitions.map(
      (tool) => tool.name,
    );
    expect(toolNames).toEqual([
      'sumo_logic_query',
      'sso_autofill_assistance',
      'form_and_related_entity_overview',
    ]);
  });

  it('should have an executeToolCall function', () => {
    expect(typeof RobotChatAnthropicToolSet.executeToolCall).toBe('function');
  });
});
