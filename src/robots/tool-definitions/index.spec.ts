import {
  slackyToolSet,
  marvToolSet,
  formOverviewToolSet,
  createCompositeToolSet,
  anthropicToolSet,
  slackyOnlyToolSet,
  marvOnlyToolSet,
} from './index';

// Import types to ensure they're exported correctly
import type { TAnthropicIstackToolSet } from './index';
import type { IToolCatalog } from './index';

describe('tool-definitions/index', () => {
  describe('Exported Tool Sets', () => {
    it('should export slackyToolSet', () => {
      expect(slackyToolSet).toBeDefined();
      expect(typeof slackyToolSet).toBe('object');
    });

    it('should export marvToolSet', () => {
      expect(marvToolSet).toBeDefined();
      expect(typeof marvToolSet).toBe('object');
    });

    it('should export formOverviewToolSet', () => {
      expect(formOverviewToolSet).toBeDefined();
      expect(typeof formOverviewToolSet).toBe('object');
    });

    it('should export createCompositeToolSet function', () => {
      expect(createCompositeToolSet).toBeDefined();
      expect(typeof createCompositeToolSet).toBe('function');
    });

    it('should export anthropicToolSet', () => {
      expect(anthropicToolSet).toBeDefined();
      expect(typeof anthropicToolSet).toBe('object');
    });

    it('should export slackyOnlyToolSet', () => {
      expect(slackyOnlyToolSet).toBeDefined();
      expect(typeof slackyOnlyToolSet).toBe('object');
    });

    it('should export marvOnlyToolSet', () => {
      expect(marvOnlyToolSet).toBeDefined();
      expect(typeof marvOnlyToolSet).toBe('object');
    });
  });

  describe('Exported Types', () => {
    it('should export TAnthropicIstackToolSet type', () => {
      // TypeScript compilation test - if this compiles, the type is exported
      const testType: TAnthropicIstackToolSet = {
        toolDefinitions: [],
        executeToolCall: async (toolName: string, toolArgs: any) => 'test',
      };
      expect(testType).toBeDefined();
    });

    it('should export IToolCatalog type', () => {
      // TypeScript compilation test - if this compiles, the type is exported
      const testCatalog: IToolCatalog = {
        toolDefinitions: [],
        executeToolCall: async (toolName: string, toolArgs: any) => 'test',
      };
      expect(testCatalog).toBeDefined();
    });
  });

  describe('Tool Set Functionality', () => {
    it('should allow creating composite tool sets', () => {
      const testCatalog1: IToolCatalog = {
        toolDefinitions: [],
        executeToolCall: async (toolName: string, toolArgs: any) => 'test1',
      };
      const testCatalog2: IToolCatalog = {
        toolDefinitions: [],
        executeToolCall: async (toolName: string, toolArgs: any) => 'test2',
      };

      const compositeSet = createCompositeToolSet(testCatalog1, testCatalog2);

      expect(compositeSet).toBeDefined();
      expect(typeof compositeSet).toBe('object');
    });

    it('should have valid tool set structures', () => {
      // Test that exported tool sets have expected structure
      const toolSets = [
        slackyToolSet,
        marvToolSet,
        formOverviewToolSet,
        anthropicToolSet,
        slackyOnlyToolSet,
        marvOnlyToolSet,
      ];

      toolSets.forEach((toolSet) => {
        expect(toolSet).toHaveProperty('toolDefinitions');
        expect(toolSet).toHaveProperty('executeToolCall');
        expect(Array.isArray(toolSet.toolDefinitions)).toBe(true);
        expect(typeof toolSet.executeToolCall).toBe('function');
      });
    });
  });
});
