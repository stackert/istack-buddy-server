import { slackyToolDefinitions } from './slackyToolDefinitions';

describe('slackyToolDefinitions', () => {
  it('should have exactly 3 tool definitions', () => {
    expect(slackyToolDefinitions).toHaveLength(3);
  });

  it('should have expected tool names', () => {
    const toolNames = slackyToolDefinitions.map((tool) => tool.name);
    expect(toolNames).toEqual([
      'sumo_logic_query',
      'sso_autofill_assistance',
      'form_and_related_entity_overview',
    ]);
  });

  describe('sumo_logic_query tool', () => {
    const sumoLogicTool = slackyToolDefinitions.find(
      (tool) => tool.name === 'sumo_logic_query',
    );

    it('should have correct structure', () => {
      expect(sumoLogicTool).toBeDefined();
      expect(sumoLogicTool?.description).toContain('Sumo Logic queries');
      expect(sumoLogicTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(sumoLogicTool?.input_schema.required).toEqual([
        'fromDate',
        'toDate',
      ]);
    });

    it('should have all expected properties', () => {
      const properties = sumoLogicTool?.input_schema.properties;
      expect(properties).toHaveProperty('fromDate');
      expect(properties).toHaveProperty('toDate');
      expect(properties).toHaveProperty('formId');
      expect(properties).toHaveProperty('submissionId');
    });
  });

  describe('sso_autofill_assistance tool', () => {
    const ssoTool = slackyToolDefinitions.find(
      (tool) => tool.name === 'sso_autofill_assistance',
    );

    it('should have correct structure', () => {
      expect(ssoTool).toBeDefined();
      expect(ssoTool?.description).toContain('SSO auto-fill');
      expect(ssoTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(ssoTool?.input_schema.required).toEqual(['formId', 'accountId']);
    });
  });

  describe('form_and_related_entity_overview tool', () => {
    const formOverviewTool = slackyToolDefinitions.find(
      (tool) => tool.name === 'form_and_related_entity_overview',
    );

    it('should have correct structure', () => {
      expect(formOverviewTool).toBeDefined();
      expect(formOverviewTool?.description).toContain('comprehensive overview');
      expect(formOverviewTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(formOverviewTool?.input_schema.required).toEqual(['formId']);
    });

    it('should include optional apiKey parameter', () => {
      const properties = formOverviewTool?.input_schema.properties;
      expect(properties).toHaveProperty('apiKey');
    });
  });
});
