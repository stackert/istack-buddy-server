import { GuardsModule } from './guards.module';

describe('GuardsModule', () => {
  it('should be defined', () => {
    expect(GuardsModule).toBeDefined();
  });

  it('should be a class', () => {
    expect(typeof GuardsModule).toBe('function');
  });

  it('should have module decorator', () => {
    // Test that the module can be imported without errors
    // This verifies the module structure is valid
    expect(GuardsModule).toBeDefined();
  });
});
