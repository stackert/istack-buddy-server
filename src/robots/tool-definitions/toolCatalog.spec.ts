import {
  createCompositeToolSet,
  anthropicToolSet,
  slackyOnlyToolSet,
  marvOnlyToolSet,
} from './toolCatalog';
import { slackyToolSet } from './slacky';
import { marvToolSet, formOverviewToolSet } from './marv';
import { SlackyToolsEnum } from './slacky/types';
import { FsRestrictedApiRoutesEnum } from './marv/types';

describe('toolCatalog', () => {
  describe('createCompositeToolSet', () => {
    it('should create a composite tool set from multiple catalogs', () => {
      const composite = createCompositeToolSet(slackyToolSet, marvToolSet);

      expect(composite).toHaveProperty('toolDefinitions');
      expect(composite).toHaveProperty('executeToolCall');
      expect(Array.isArray(composite.toolDefinitions)).toBe(true);
      expect(typeof composite.executeToolCall).toBe('function');
    });

    it('should merge tool definitions from multiple catalogs', () => {
      const composite = createCompositeToolSet(slackyToolSet, marvToolSet);

      const expectedToolCount =
        slackyToolSet.toolDefinitions.length +
        marvToolSet.toolDefinitions.length;
      expect(composite.toolDefinitions).toHaveLength(expectedToolCount);

      // Check that tools from both catalogs are present
      const toolNames = composite.toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toContain(SlackyToolsEnum.SumoLogicQuery);
      expect(toolNames).toContain(SlackyToolsEnum.SsoAutofillAssistance);
      expect(toolNames).toContain(
        'fsRestrictedApiFormAndRelatedEntityOverview',
      );
    });
  });

  describe('executeToolCall routing', () => {
    it('should route to first catalog that handles the tool', async () => {
      const composite = createCompositeToolSet(slackyToolSet, marvToolSet);

      // Test slacky tool
      const slackyResult = composite.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
        },
      );

      expect(slackyResult).toBeDefined();
      expect(await slackyResult).toContain('Sumo Logic Query Analysis');
    });

    it('should throw error when no catalog handles the tool', async () => {
      const composite = createCompositeToolSet(slackyToolSet, marvToolSet);

      await expect(
        composite.executeToolCall('unknown_tool', {}),
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });

  describe('pre-configured tool sets', () => {
    describe('anthropicToolSet', () => {
      it('should be a composite of slacky and form overview tools only', () => {
        const expectedToolCount =
          slackyToolSet.toolDefinitions.length +
          formOverviewToolSet.toolDefinitions.length;
        expect(anthropicToolSet.toolDefinitions).toHaveLength(
          expectedToolCount,
        );

        const toolNames = anthropicToolSet.toolDefinitions.map(
          (tool) => tool.name,
        );
        expect(toolNames).toContain(SlackyToolsEnum.SumoLogicQuery);
        expect(toolNames).toContain(SlackyToolsEnum.SsoAutofillAssistance);
        expect(toolNames).toContain(
          'fsRestrictedApiFormAndRelatedEntityOverview',
        );

        // Should NOT contain other marv tools like fieldRemove
        expect(toolNames).not.toContain('fieldRemove');
        expect(toolNames).not.toContain('fsRestrictedApiFormLiteAdd');
      });
    });

    describe('slackyOnlyToolSet', () => {
      it('should only contain slacky tools', () => {
        expect(slackyOnlyToolSet.toolDefinitions).toHaveLength(
          slackyToolSet.toolDefinitions.length,
        );

        const toolNames = slackyOnlyToolSet.toolDefinitions.map(
          (tool) => tool.name,
        );
        expect(toolNames).toContain(SlackyToolsEnum.SumoLogicQuery);
        expect(toolNames).toContain(SlackyToolsEnum.SsoAutofillAssistance);
        expect(toolNames).not.toContain(
          FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        );
      });
    });

    describe('marvOnlyToolSet', () => {
      it('should only contain marv tools', () => {
        expect(marvOnlyToolSet.toolDefinitions).toHaveLength(
          marvToolSet.toolDefinitions.length,
        );

        const toolNames = marvOnlyToolSet.toolDefinitions.map(
          (tool) => tool.name,
        );
        expect(toolNames).toContain(
          'fsRestrictedApiFormAndRelatedEntityOverview',
        );
        expect(toolNames).not.toContain(SlackyToolsEnum.SumoLogicQuery);
        expect(toolNames).not.toContain(SlackyToolsEnum.SsoAutofillAssistance);
      });
    });

    describe('formOverviewToolSet', () => {
      it('should only contain FormAndRelatedEntityOverview tool', () => {
        expect(formOverviewToolSet.toolDefinitions).toHaveLength(1);

        const toolNames = formOverviewToolSet.toolDefinitions.map(
          (tool) => tool.name,
        );
        expect(toolNames).toEqual([
          'fsRestrictedApiFormAndRelatedEntityOverview',
        ]);
        expect(toolNames).not.toContain('fieldRemove');
        expect(toolNames).not.toContain('fsRestrictedApiFormLiteAdd');
      });
    });
  });
});
