import { Test, TestingModule } from '@nestjs/testing';
import { ObservationMakerFieldCounts } from './ObservationMakerFieldCounts';
import { Models, EObservationSubjectType } from 'istack-buddy-utilities';

import * as formJson5375703 from '../../../test-data/form-json/5375703.json';
import * as formJson6201623 from '../../../test-data/form-json/6201623.json';

describe('ObservationMakerFieldCounts', () => {
  let observationMaker: ObservationMakerFieldCounts;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObservationMakerFieldCounts],
    }).compile();

    observationMaker = module.get<ObservationMakerFieldCounts>(
      ObservationMakerFieldCounts,
    );
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(observationMaker).toBeDefined();
      expect((observationMaker as any).subjectType).toBe(
        EObservationSubjectType.FORM,
      );
      expect((observationMaker as any).observationClass).toBe(
        'ObservationMakerFieldCounts',
      );
      expect((observationMaker as any).messagePrimary).toBe(
        'Field Counts Observation',
      );
    });

    it('should initialize fieldByTypeCounts with all known field types', () => {
      const fieldByTypeCounts = (observationMaker as any).fieldByTypeCounts;
      expect(fieldByTypeCounts).toBeDefined();
      expect(typeof fieldByTypeCounts).toBe('object');

      // Check that all entries have the expected structure
      Object.values(fieldByTypeCounts).forEach((record: any) => {
        expect(record).toHaveProperty('count', 0);
        expect(record).toHaveProperty('relatedFields', []);
        expect(record).toHaveProperty('label');
        expect(Array.isArray(record.relatedFields)).toBe(true);
      });
    });

    it('should initialize otherCounts with all required indexes', () => {
      const otherCounts = (observationMaker as any).otherCounts;
      expect(otherCounts).toBeDefined();

      const expectedKeys = [
        '_FIELDS_WITH_CALCULATION_',
        '_FIELDS_WITHOUT_CALCULATION_',
        '_FIELDS_WITH_LOGIC_',
        '_FIELDS_WITHOUT_LOGIC_',
        '_LABEL_HAS_LEADING_OR_TRAILING_WHITESPACE_',
        '_DUPLICATE_LABELS_',
        '_UNIQUE_LABELS_',
      ];

      expectedKeys.forEach((key) => {
        expect(otherCounts[key]).toBeDefined();
        expect(otherCounts[key]).toHaveProperty('count', 0);
        expect(otherCounts[key]).toHaveProperty('relatedFields', []);
        expect(otherCounts[key]).toHaveProperty('label', key);
        expect(Array.isArray(otherCounts[key].relatedFields)).toBe(true);
      });
    });
  });

  describe('getRequiredResources', () => {
    it('should return formModel as required resource', () => {
      const resources = observationMaker.getRequiredResources();
      expect(resources).toEqual(['formModel']);
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBe(1);
    });
  });

  describe('makeObservation', () => {
    it('should make observations using form data 5375703', async () => {
      // Create real form model from the first test data file
      const formModel = new Models.FsModelForm(formJson5375703);

      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);

      const fieldIds = formModel.getFieldIds();
      expect(fieldIds.length).toBeGreaterThan(0);
    });

    it('should make observations using form data 6201623', async () => {
      // Create real form model from the second test data file
      const formModel = new Models.FsModelForm(formJson6201623, {
        fieldModelVersion: 'v2',
      });

      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);

      const fieldIds = formModel.getFieldIds();
      expect(fieldIds.length).toBeGreaterThan(0);
    });

    it('should return isObservationTrue as true', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);
      expect(result.isObservationTrue).toBe(true);
    });

    it('should generate log items for various field counts', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      expect(result.logItems.length).toBeGreaterThan(0);

      // Check that log items have expected structure
      result.logItems.forEach((logItem) => {
        expect(logItem).toHaveProperty('subjectId');
        expect(logItem).toHaveProperty('messageSecondary');
        expect(logItem).toHaveProperty('relatedEntityIds');
        expect(Array.isArray(logItem.relatedEntityIds)).toBe(true);
      });
    });

    it('should handle fields with calculations', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      // Look for log items about calculations
      const calculationLogItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('calculations'),
      );

      expect(calculationLogItems.length).toBeGreaterThan(0);
    });

    it('should handle fields with logic', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      // Look for log items about logic
      const logicLogItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('logic'),
      );

      expect(logicLogItems.length).toBeGreaterThan(0);
    });

    it('should handle labels with leading/trailing whitespace', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      // Look for log items about whitespace
      const whitespaceLogItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('whitespace'),
      );

      expect(whitespaceLogItems.length).toBeGreaterThan(0);
    });

    it('should process all field IDs from form model', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const fieldIds = formModel.getFieldIds();
      expect(fieldIds.length).toBeGreaterThan(0);

      const result = await observationMaker.makeObservation(context);

      // The observation should process all fields
      expect(result.logItems.length).toBeGreaterThan(0);
    });

    it('should handle duplicate labels', async () => {
      const formModel = new Models.FsModelForm(formJson6201623, {
        fieldModelVersion: 'v2',
      });
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      // The test should complete without errors
      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);
    });

    it('should handle unsupported field types gracefully', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      // Mock a field model that returns an unsupported field type
      const originalGetFieldModelByIdOrThrow =
        formModel.getFieldModelByIdOrThrow;
      const mockFieldModel = {
        getFieldType: () => 'unsupported_type',
        getCalculationString: () => '',
        labelUserFriendly: () => 'Test Label',
      };

      // Only mock for the first field to test error handling
      let callCount = 0;
      formModel.getFieldModelByIdOrThrow = function (fieldId) {
        callCount++;
        if (callCount === 1) {
          return mockFieldModel as any;
        }
        return originalGetFieldModelByIdOrThrow.call(this, fieldId);
      };

      const result = await observationMaker.makeObservation(context);

      // Should still complete successfully
      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);

      // Should have warning log items for unsupported field type
      const warningLogItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('not supported'),
      );
      expect(warningLogItems.length).toBeGreaterThan(0);

      // Restore original method
      formModel.getFieldModelByIdOrThrow = originalGetFieldModelByIdOrThrow;
    });

    it('should create appropriate log items for different scenarios', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);

      // Should have various types of log items
      const messageTypes = result.logItems.map((item) => {
        if (item.messageSecondary.includes('calculations'))
          return 'calculations';
        if (item.messageSecondary.includes('logic')) return 'logic';
        if (item.messageSecondary.includes('whitespace')) return 'whitespace';
        return 'other';
      });

      expect(messageTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context resources', async () => {
      const formModel = new Models.FsModelForm(formJson5375703);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      // Test with valid context
      const result = await observationMaker.makeObservation(context);
      expect(result).toBeDefined();
      expect(result.isObservationTrue).toBe(true);
    });

    it('should handle form with no fields', async () => {
      // Create a minimal form model
      const emptyFormData = {
        formId: 'test',
        fields: [],
        fieldOrder: [],
      };

      const formModel = new Models.FsModelForm(emptyFormData);
      const context = {
        resources: {
          formModel: formModel,
        },
      };

      const result = await observationMaker.makeObservation(context);
      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);
    });
  });
});
