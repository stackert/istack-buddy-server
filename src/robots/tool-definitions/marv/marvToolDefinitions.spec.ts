import { marvToolDefinitions } from './marvToolDefinitions';

describe('marvToolDefinitions', () => {
  describe('Structure Validation', () => {
    it('should be defined and be an array', () => {
      expect(marvToolDefinitions).toBeDefined();
      expect(Array.isArray(marvToolDefinitions)).toBe(true);
    });

    it('should contain 14 tool definitions', () => {
      expect(marvToolDefinitions).toHaveLength(14);
    });

    it('should have all tools conform to Anthropic.Messages.Tool interface', () => {
      marvToolDefinitions.forEach((tool, index) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('input_schema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.input_schema).toBe('object');
      });
    });
  });

  describe('Tool Names', () => {
    it('should have the expected tool names', () => {
      const expectedToolNames = [
        'fieldRemove',
        'fsRestrictedApiFormLiteAdd',
        'fsRestrictedApiFieldLiteAdd',
        'fsRestrictedApiFieldLabelUniqueSlugAdd',
        'fsRestrictedApiFieldLabelUniqueSlugRemove',
        'fsRestrictedApiFieldLogicRemove',
        'fsRestrictedApiFieldLogicStashCreate',
        'fsRestrictedApiFieldLogicStashApply',
        'fsRestrictedApiFieldLogicStashApplyAndRemove',
        'fsRestrictedApiFieldLogicStashRemove',
        'fsRestrictedApiFormDeveloperCopy',
        'fsRestrictedApiFormAndRelatedEntityOverview',
        'fsRestrictedApiFormLogicValidation',
        'fsRestrictedApiFormCalculationValidation',
      ];

      const actualToolNames = marvToolDefinitions.map((tool) => tool.name);
      expect(actualToolNames).toEqual(expectedToolNames);
    });

    it('should have unique tool names', () => {
      const toolNames = marvToolDefinitions.map((tool) => tool.name);
      const uniqueNames = new Set(toolNames);
      expect(uniqueNames.size).toBe(toolNames.length);
    });
  });

  describe('Input Schema Validation', () => {
    it('should have valid input schemas with type object', () => {
      marvToolDefinitions.forEach((tool) => {
        expect(tool.input_schema.type).toBe('object');
        expect(tool.input_schema).toHaveProperty('properties');
        expect(tool.input_schema).toHaveProperty('required');
        expect(Array.isArray(tool.input_schema.required)).toBe(true);
      });
    });

    it('should have all required properties defined in properties', () => {
      marvToolDefinitions.forEach((tool) => {
        const { properties, required } = tool.input_schema;
        const props = properties as Record<string, any>;
        (required || []).forEach((requiredProp: string) => {
          expect(props).toHaveProperty(requiredProp);
        });
      });
    });
  });

  describe('Individual Tool Definitions', () => {
    describe('fieldRemove', () => {
      const fieldRemoveTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fieldRemove',
      )!;

      it('should have correct structure', () => {
        expect(fieldRemoveTool.name).toBe('fieldRemove');
        expect(fieldRemoveTool.description).toContain(
          'Remove a field from a form',
        );
        expect(fieldRemoveTool.input_schema.required).toEqual(['fieldId']);
      });

      it('should have fieldId property', () => {
        const props = fieldRemoveTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.fieldId).toBeDefined();
        expect(props.fieldId.type).toBe('string');
        expect(props.fieldId.description).toContain(
          'ID of the field to remove',
        );
      });
    });

    describe('fsRestrictedApiFormLiteAdd', () => {
      const formLiteAddTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fsRestrictedApiFormLiteAdd',
      )!;

      it('should have correct structure', () => {
        expect(formLiteAddTool.name).toBe('fsRestrictedApiFormLiteAdd');
        expect(formLiteAddTool.description).toContain(
          'Create a formstack form',
        );
        expect(formLiteAddTool.description).toContain('MARV ENABLED FORMS');
        expect(formLiteAddTool.input_schema.required).toEqual([
          'formName',
          'fields',
        ]);
      });

      it('should have formName property', () => {
        const props = formLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.formName).toBeDefined();
        expect(props.formName.type).toBe('string');
      });

      it('should have fields array property with correct structure', () => {
        const props = formLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.fields).toBeDefined();
        expect(props.fields.type).toBe('array');
        expect(props.fields.items).toBeDefined();
        expect(props.fields.items.type).toBe('object');
        expect(props.fields.items.required).toEqual(['label', 'field_type']);
      });

      it('should have valid field_type enum values', () => {
        const props = formLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        const fieldTypeEnum = props.fields.items.properties.field_type.enum;
        const expectedEnum = [
          'text',
          'number',
          'datetime',
          'email',
          'phone',
          'address',
          'signature',
          'file',
          'section',
        ];
        expect(fieldTypeEnum).toEqual(expectedEnum);
      });
    });

    describe('fsRestrictedApiFieldLiteAdd', () => {
      const fieldLiteAddTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fsRestrictedApiFieldLiteAdd',
      )!;

      it('should have correct structure', () => {
        expect(fieldLiteAddTool.name).toBe('fsRestrictedApiFieldLiteAdd');
        expect(fieldLiteAddTool.description).toContain(
          'Adds a field to the current form',
        );
        expect(fieldLiteAddTool.description).toContain('MARV ENABLED FORMS');
        expect(fieldLiteAddTool.input_schema.required).toEqual([
          'formId',
          'label',
          'field_type',
        ]);
      });

      it('should have all required properties', () => {
        const props = fieldLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.formId).toBeDefined();
        expect(props.label).toBeDefined();
        expect(props.field_type).toBeDefined();
        expect(props.isHidden).toBeDefined();
        expect(props.isRequired).toBeDefined();
      });

      it('should have valid field_type enum values', () => {
        const props = fieldLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        const fieldTypeEnum = props.field_type.enum;
        const expectedEnum = [
          'text',
          'number',
          'datetime',
          'email',
          'phone',
          'address',
          'signature',
          'file',
          'section',
        ];
        expect(fieldTypeEnum).toEqual(expectedEnum);
      });

      it('should have boolean optional properties', () => {
        const props = fieldLiteAddTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.isHidden.type).toBe('boolean');
        expect(props.isRequired.type).toBe('boolean');
      });
    });

    describe('fsRestrictedApiFormDeveloperCopy', () => {
      const formCopyTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fsRestrictedApiFormDeveloperCopy',
      )!;

      it('should have correct structure', () => {
        expect(formCopyTool.name).toBe('fsRestrictedApiFormDeveloperCopy');
        expect(formCopyTool.description).toContain(
          'Creates a developer copy of a form',
        );
        expect(formCopyTool.description).toContain('MARV ENABLED FORMS');
        expect(formCopyTool.input_schema.required).toEqual(['formId']);
      });

      it('should have formId property', () => {
        const props = formCopyTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props.formId).toBeDefined();
        expect(props.formId.type).toBe('string');
        expect(props.formId.description).toContain(
          'ID of the form to create a developer copy of',
        );
      });
    });
  });

  describe('MARV Restriction Validation', () => {
    it('should have MARV restriction mentioned in all restricted tools', () => {
      const restrictedTools = marvToolDefinitions.filter((tool) =>
        tool.name.startsWith('fsRestrictedApi'),
      );

      expect(restrictedTools).toHaveLength(13); // All tools except fieldRemove

      restrictedTools.forEach((tool) => {
        expect(tool.description || '').toContain('MARV ENABLED FORMS');
      });
    });

    it('should not have MARV restriction in fieldRemove tool', () => {
      const fieldRemoveTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fieldRemove',
      )!;
      expect(fieldRemoveTool.description).not.toContain('MARV ENABLED FORMS');
    });
  });

  describe('Property Type Validation', () => {
    it('should have string type for all formId properties', () => {
      const toolsWithFormId = marvToolDefinitions.filter((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        return props.formId;
      });

      toolsWithFormId.forEach((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        expect(props.formId.type).toBe('string');
      });
    });

    it('should have string type for all fieldId properties', () => {
      const toolsWithFieldId = marvToolDefinitions.filter((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        return props.fieldId;
      });

      toolsWithFieldId.forEach((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        expect(props.fieldId.type).toBe('string');
      });
    });

    it('should have string type for all label properties', () => {
      const toolsWithLabel = marvToolDefinitions.filter((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        return props.label;
      });

      toolsWithLabel.forEach((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        expect(props.label.type).toBe('string');
      });
    });
  });

  describe('Description Quality', () => {
    it('should have non-empty descriptions for all tools', () => {
      marvToolDefinitions.forEach((tool) => {
        expect((tool.description || '').length).toBeGreaterThan(0);
        expect((tool.description || '').trim()).toBe(tool.description || '');
      });
    });

    it('should have descriptions for all properties', () => {
      marvToolDefinitions.forEach((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        Object.values(props).forEach((property: any) => {
          expect(property.description).toBeDefined();
          expect(typeof property.description).toBe('string');
          expect(property.description.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Logic Management Tools', () => {
    const logicToolNames = [
      'fsRestrictedApiFieldLogicRemove',
      'fsRestrictedApiFieldLogicStashCreate',
      'fsRestrictedApiFieldLogicStashApply',
      'fsRestrictedApiFieldLogicStashApplyAndRemove',
      'fsRestrictedApiFieldLogicStashRemove',
    ];

    it('should have all logic management tools', () => {
      logicToolNames.forEach((toolName) => {
        const tool = marvToolDefinitions.find((t) => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool!.description).toContain('MARV ENABLED FORMS');
        expect(tool!.input_schema.required).toEqual(['formId']);
      });
    });

    it('should have correct descriptions for logic tools', () => {
      const descriptions = {
        fsRestrictedApiFieldLogicRemove: 'Removes all logic from fields',
        fsRestrictedApiFieldLogicStashCreate: 'Stashes (saves) all field logic',
        fsRestrictedApiFieldLogicStashApply:
          'Applies previously stashed field logic',
        fsRestrictedApiFieldLogicStashApplyAndRemove:
          'Applies previously stashed field logic back to a form and then removes the stash',
        fsRestrictedApiFieldLogicStashRemove:
          'Removes the logic stash from a form without applying it',
      };

      Object.entries(descriptions).forEach(([toolName, expectedText]) => {
        const tool = marvToolDefinitions.find((t) => t.name === toolName)!;
        expect(tool.description).toContain(expectedText);
      });
    });
  });

  describe('Slug Management Tools', () => {
    it('should have slug add tool with correct structure', () => {
      const slugAddTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fsRestrictedApiFieldLabelUniqueSlugAdd',
      )!;
      expect(slugAddTool.name).toBe('fsRestrictedApiFieldLabelUniqueSlugAdd');
      expect(slugAddTool.description).toContain('Adds unique slugs');
      expect(slugAddTool.description).toContain('MARV ENABLED FORMS');
      expect(slugAddTool.input_schema.required).toEqual(['formId']);
    });

    it('should have slug remove tool with correct structure', () => {
      const slugRemoveTool = marvToolDefinitions.find(
        (tool) => tool.name === 'fsRestrictedApiFieldLabelUniqueSlugRemove',
      )!;
      expect(slugRemoveTool.name).toBe(
        'fsRestrictedApiFieldLabelUniqueSlugRemove',
      );
      expect(slugRemoveTool.description).toContain('Removes unique slugs');
      expect(slugRemoveTool.description).toContain('MARV ENABLED FORMS');
      expect(slugRemoveTool.input_schema.required).toEqual(['formId']);
    });
  });

  describe('Enum Consistency', () => {
    it('should have consistent field_type enums across tools', () => {
      const expectedFieldTypes = [
        'text',
        'number',
        'datetime',
        'email',
        'phone',
        'address',
        'signature',
        'file',
        'section',
      ];

      const toolsWithFieldType = marvToolDefinitions.filter((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        return (
          props.field_type ||
          (props.fields &&
            props.fields.items &&
            props.fields.items.properties.field_type)
        );
      });

      toolsWithFieldType.forEach((tool) => {
        const props = tool.input_schema.properties as Record<string, any>;
        let fieldTypeEnum;
        if (props.field_type) {
          fieldTypeEnum = props.field_type.enum;
        } else {
          fieldTypeEnum = props.fields.items.properties.field_type.enum;
        }

        expect(fieldTypeEnum).toEqual(expectedFieldTypes);
      });
    });
  });
});
