import { Models, ELogLevel } from 'istack-buddy-utilities';
import { ObservationMakerFieldCounts } from './ObservationMakerFieldCounts';
import * as testFormData from '../../../test-data/form-json/data-bricks/5375703.json';

describe('FormObservationMaker', () => {
  let formModel: Models.FsModelForm;
  let observationMaker: ObservationMakerFieldCounts;

  beforeEach(() => {
    // Create form model from real JSON data
    formModel = new Models.FsModelForm(testFormData);

    // Use real observation maker from istack-buddy-utilities
    observationMaker = new ObservationMakerFieldCounts();
  });

  it('should create form model from real JSON data', () => {
    expect(formModel).toBeDefined();
    expect(formModel.formId).toBe('5375703');
    expect(formModel.getFieldIds().length).toBeGreaterThan(0);
  });

  it('should have correct field count from real data', () => {
    const fieldCount = formModel.getFieldIds().length;
    expect(fieldCount).toBe(60);
  });

  it('should run observations on form model and return results', async () => {
    // Create observation context
    const context = {
      resources: {
        formModel: formModel,
      },
    };

    // Run observation
    const result = await observationMaker.makeObservation(context);

    // Verify results
    expect(result).toBeDefined();
    expect(result.logItems).toBeDefined();
    expect(result.logItems.length).toBeGreaterThan(0);

    // Count log items by level using built-in ObservationMaker methods
    const infoCount = observationMaker.filterByLogLevel(ELogLevel.INFO).length;
    const warnCount = observationMaker.filterByLogLevel(ELogLevel.WARN).length;
    const errorCount = observationMaker.filterByLogLevel(
      ELogLevel.ERROR,
    ).length;

    // Test results - exact counts
    expect(result.logItems.length).toBe(7);
    expect(infoCount).toBe(5);
    expect(warnCount).toBe(2);
    expect(errorCount).toBe(0);
  });
});
