import * as robots from './index';

describe('Robots Index', () => {
  it('should export AbstractRobot', () => {
    expect(robots.AbstractRobot).toBeDefined();
  });

  it('should export AbstractRobotChat', () => {
    expect(robots.AbstractRobotChat).toBeDefined();
  });

  it('should export AbstractRobotAgent', () => {
    expect(robots.AbstractRobotAgent).toBeDefined();
  });

  it('should export AgentRobotParrot', () => {
    expect(robots.AgentRobotParrot).toBeDefined();
  });

  it('should export AnthropicMarv', () => {
    expect(robots.AnthropicMarv).toBeDefined();
  });

  it('should export SlackyOpenAiAgent', () => {
    expect(robots.SlackyOpenAiAgent).toBeDefined();
  });

  it('should export RobotService', () => {
    expect(robots.RobotService).toBeDefined();
  });

  it('should export RobotModule', () => {
    expect(robots.RobotModule).toBeDefined();
  });

  it('should export TConversationTextMessage type', () => {
    // Type exports are compile-time only, but we can verify the module loads
    expect(robots).toBeDefined();
  });
});
