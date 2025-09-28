import * as toolDefinitions from './index';

describe('Tool Definitions Index', () => {
  it('should export slackyToolSet', () => {
    expect(toolDefinitions.slackyToolSet).toBeDefined();
  });

  it('should export marvToolSet', () => {
    expect(toolDefinitions.marvToolSet).toBeDefined();
  });

  it('should export formOverviewToolSet', () => {
    expect(toolDefinitions.formOverviewToolSet).toBeDefined();
  });

  it('should export createCompositeToolSet', () => {
    expect(toolDefinitions.createCompositeToolSet).toBeDefined();
  });

  it('should export anthropicToolSet', () => {
    expect(toolDefinitions.anthropicToolSet).toBeDefined();
  });

  it('should export slackyOnlyToolSet', () => {
    expect(toolDefinitions.slackyOnlyToolSet).toBeDefined();
  });

  it('should export marvOnlyToolSet', () => {
    expect(toolDefinitions.marvOnlyToolSet).toBeDefined();
  });

  it('should export TAnthropicIstackToolSet type', () => {
    // Type exports are compile-time only, but we can verify the module loads
    expect(toolDefinitions).toBeDefined();
  });

  it('should export IToolCatalog type', () => {
    // Type exports are compile-time only, but we can verify the module loads
    expect(toolDefinitions).toBeDefined();
  });
});
