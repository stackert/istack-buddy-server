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
});
