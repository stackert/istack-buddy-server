import { Test, TestingModule } from '@nestjs/testing';
import { ObservationMakerLogicValidation } from './ObservationMakerLogicValidation';
import { Models } from 'istack-buddy-utilities';

import * as formJson5375703 from '../../../test-data/form-json/5375703.json';

describe('ObservationMakerLogicValidation', () => {
  let observationMaker: ObservationMakerLogicValidation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObservationMakerLogicValidation],
    }).compile();

    observationMaker = module.get<ObservationMakerLogicValidation>(
      ObservationMakerLogicValidation,
    );
  });

  it('should make observations and return log items', async () => {
    // Create real form model from test data file
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
  });
});
