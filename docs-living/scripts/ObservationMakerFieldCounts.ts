import {
  ObservationMakers,
  // TreeCalculations,
  //   TreeVisibility,
  // TreeSystems,
  Models,
  TreeUtilities,
  EObservationSubjectType,
  // LogLevel,
} from 'istack-buddy-utilities';

import type {
  IObservationContext,
  IObservationResult,
  IObservationLogItem,
  TFsVisibilityErrorNode,
  TFsCalcErrorNode,

  // IFsModelForm,
  //  LogLevel,
} from 'istack-buddy-utilities';

import type { IFsModelForm, TFsFieldType } from 'istack-buddy-utilities';

const knownFieldTypes: TFsFieldType[] = [
  'address',
  'checkbox',
  'creditcard',
  'datetime',
  'email',
  'embed',
  'file',
  'matrix',
  'section',
  'select',
  'signature',
  'text',
  'textarea',
  'name',
  'number',
  'phone',
  'product',
  'radio',
  'rating',
  'richtext',
];
const fieldTypes = '';

class ObservationMakerFieldCounts extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FIELD;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Field Logic Validation Check';
  private fieldByTypeCounts: Record<TFsFieldType, number>;
  private otherCounts: Record<string, number> = {};

  // { [idx: keyof TFsFieldType]: number } = {};

  constructor() {
    super();
    `
need to fix  otherCounts to be 'known' and not on the fly, complete with labels
otherCountItem  {
    key:
    label
    count
  }



`;
    this.fieldByTypeCounts = knownFieldTypes.reduce(
      (acc, cur) => {
        acc[cur] = 0;
        return acc;
      },
      {} as Record<TFsFieldType, number>,
    );

    this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'] = 0;
    this.otherCounts['_FIELDS_WITH_CALCULATION_'] = 0;
    this.otherCounts['_FOUND_CALCULATION_ERRORS_'] = 0;
  }

  getRequiredResources(): string[] {
    return ['formModel'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    let isObservationTrue = false;
    const logItems: IObservationLogItem[] = [];

    const formModel: IFsModelForm = context.resources.formModel;

    formModel.getFieldIds().forEach((fieldId) => {
      const fieldModel = formModel.getFieldModelByIdOrThrow(fieldId);
      this.fieldByTypeCounts[fieldModel.getFieldType()]++;

      const shallowTree =
        TreeUtilities.FsCalculationGraphShallow.fromCalcStringJson(
          fieldId,
          fieldModel.getCalculationString() || '',
        );

      if (!shallowTree) {
        this.otherCounts['_FIELDS_WITHOUT_CALCULATION_']++;
      } else {
        this.otherCounts['_FIELDS_WITH_CALCULATION_']++;
        if (shallowTree.getAllErrorNodes().length > 0) {
          this.otherCounts['_FIELDS_WITH_CALCULATION_'] +=
            shallowTree.getAllErrorNodes().length;
          (shallowTree.getAllErrorNodes() as TFsCalcErrorNode[]).forEach(
            (errorNode: TFsCalcErrorNode) => {
              const relatedEntityIds = (
                errorNode.calcError.dependencyChainFieldIds || []
              ).map((depItem) => {
                return depItem.directOwnerFieldId;
              });

              const logItem = this.createWarnLogItem(context, {
                subjectId: fieldId,
                messageSecondary: errorNode.calcError.message,
                relatedEntityIds,
                additionalDetails: errorNode,
              });
              logItems.push(logItem);
            },
          );
        }
      }
    });

    // this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'] = 0;
    // this.otherCounts['_FIELDS_WITH_CALCULATION_'] = 0;
    // this.otherCounts['_FOUND_CALCULATION_ERRORS_'] = 0;

    return { isObservationTrue: true, logItems };
  }
}

export { ObservationMakerFieldCounts };
