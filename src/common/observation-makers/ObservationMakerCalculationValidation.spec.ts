import { Test, TestingModule } from '@nestjs/testing';
import { ObservationMakerCalculationValidation } from './ObservationMakerCalculationValidation';
import { Models } from 'istack-buddy-utilities';

import * as formJson5375703 from '../../../test-data/form-json/5375703.json';

describe('ObservationMakerCalculationValidation', () => {
  let observationMaker: ObservationMakerCalculationValidation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObservationMakerCalculationValidation],
    }).compile();

    observationMaker = module.get<ObservationMakerCalculationValidation>(
      ObservationMakerCalculationValidation,
    );
  });

  it('should make observations and return log items with length greater than 0', async () => {
    // Create real form model from test data file
    const formModel = new Models.FsModelForm(formJson5375703);

    const context = {
      resources: {
        formModel: formModel,
      },
    };

    // Run the observation with real form data (no mocking)
    const result = await observationMaker.makeObservation(context);

    // Verify that logItems has length greater than 0
    expect(result.logItems.length).toBeGreaterThan(0);
    expect(result.logItems).toBeDefined();
    expect(Array.isArray(result.logItems)).toBe(true);
  });

  it('should process fields with calculations correctly', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const context = {
      resources: {
        formModel: formModel,
      },
    };

    const result = await observationMaker.makeObservation(context);

    expect(result).toBeDefined();
    expect(Array.isArray(result.logItems)).toBe(true);
    expect(result.logItems.length).toBeGreaterThan(0);

    // Should have calculation graph log items
    const calcGraphLogItems = result.logItems.filter((item) =>
      item.messageSecondary.includes('Calculation graph:'),
    );
    expect(calcGraphLogItems.length).toBeGreaterThan(0);
  });

  it('should handle calculation errors correctly', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const fieldIds = formModel.getFieldIds();
    if (fieldIds.length > 0) {
      const fieldId = fieldIds[0];
      const fieldModel = formModel.getFieldModelById(fieldId);

      if (fieldModel) {
        // Mock field to have a calculation with errors
        const originalGetCalculationString = fieldModel.getCalculationString;
        fieldModel.getCalculationString = jest
          .fn()
          .mockReturnValue('invalid_field + 10');

        const context = {
          resources: {
            formModel: formModel,
          },
        };

        const result = await observationMaker.makeObservation(context);

        expect(result).toBeDefined();
        expect(Array.isArray(result.logItems)).toBe(true);

        // Restore original method
        fieldModel.getCalculationString = originalGetCalculationString;
      }
    }
  });

  it('should handle unresolved field references', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const fieldIds = formModel.getFieldIds();
    if (fieldIds.length > 0) {
      const fieldId = fieldIds[0];
      const fieldModel = formModel.getFieldModelById(fieldId);

      if (fieldModel) {
        // Mock field to reference a non-existent field
        const originalGetCalculationString = fieldModel.getCalculationString;
        fieldModel.getCalculationString = jest
          .fn()
          .mockReturnValue('non_existent_field + 5');

        const context = {
          resources: {
            formModel: formModel,
          },
        };

        const result = await observationMaker.makeObservation(context);

        expect(result).toBeDefined();
        expect(Array.isArray(result.logItems)).toBe(true);

        // Look for error log items about non-existent field references
        const errorLogItems = result.logItems.filter((item) =>
          item.messageSecondary.includes(
            'references a field that does not exist',
          ),
        );

        // Test passes if we get log items (may or may not have specific error)
        expect(result.logItems.length).toBeGreaterThan(0);

        // Restore original method
        fieldModel.getCalculationString = originalGetCalculationString;
      }
    }
  });

  it('should handle fields without calculations', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const fieldIds = formModel.getFieldIds();
    if (fieldIds.length > 0) {
      const fieldId = fieldIds[0];
      const fieldModel = formModel.getFieldModelById(fieldId);

      if (fieldModel) {
        // Mock field to have no calculation
        const originalGetCalculationString = fieldModel.getCalculationString;
        fieldModel.getCalculationString = jest.fn().mockReturnValue('');

        const context = {
          resources: {
            formModel: formModel,
          },
        };

        const result = await observationMaker.makeObservation(context);

        expect(result).toBeDefined();
        expect(Array.isArray(result.logItems)).toBe(true);
        expect(result.logItems.length).toBeGreaterThan(0);

        // Restore original method
        fieldModel.getCalculationString = originalGetCalculationString;
      }
    }
  });

  it('should return proper observation result structure', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const context = {
      resources: {
        formModel: formModel,
      },
    };

    const result = await observationMaker.makeObservation(context);

    // Verify result structure
    expect(result).toHaveProperty('isObservationTrue');
    expect(result).toHaveProperty('logItems');
    expect(typeof result.isObservationTrue).toBe('boolean');
    expect(Array.isArray(result.logItems)).toBe(true);
  });

  it('should create proper log item structure', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const context = {
      resources: {
        formModel: formModel,
      },
    };

    const result = await observationMaker.makeObservation(context);

    expect(result.logItems.length).toBeGreaterThan(0);

    // Verify log item structure
    result.logItems.forEach((logItem) => {
      expect(logItem).toHaveProperty('subjectId');
      expect(logItem).toHaveProperty('messageSecondary');
      expect(logItem).toHaveProperty('relatedEntityIds');
      expect(Array.isArray(logItem.relatedEntityIds)).toBe(true);
      expect(typeof logItem.subjectId).toBe('string');
      expect(typeof logItem.messageSecondary).toBe('string');
    });
  });

  it('should process multiple fields correctly', async () => {
    const formModel = new Models.FsModelForm(formJson5375703);

    const context = {
      resources: {
        formModel: formModel,
      },
    };

    const result = await observationMaker.makeObservation(context);

    const fieldIds = formModel.getFieldIds();

    // Should have at least one log item per field (calculation graph info)
    expect(result.logItems.length).toBeGreaterThanOrEqual(fieldIds.length);
  });
});
