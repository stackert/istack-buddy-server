import {
  ObservationMakers,
  // TreeCalculations,
  //   TreeVisibility,
  // TreeSystems,
  Models,
  TreeUtilities,
  EObservationSubjectType,
  ALL_KNOWN_FS_FIELD_TYPES,
  // LogLevel,
} from 'istack-buddy-utilities';

import type {
  IObservationContext,
  IObservationResult,
  IObservationLogItem,
  IFsModelForm,
  TFsFieldType,
} from 'istack-buddy-utilities';

const knownFieldTypes: TFsFieldType[] = [...ALL_KNOWN_FS_FIELD_TYPES];

type TCountRecord = {
  label: string;
  count: number;
  relatedFields: string[];
};

const otherCountIndexes = [
  '_FIELDS_WITH_CALCULATION_',
  '_FIELDS_WITHOUT_CALCULATION_',
  '_FIELDS_WITH_CALCULATION_ERRORS_',
  '_FIELDS_WITHOUT_CALCULATION_ERRORS_',
] as const;

type TOtherCountIndex = (typeof otherCountIndexes)[number];

const fieldTypes = '';

class ObservationMakerCalculationValidation extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FIELD;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Field Calculation Validation';
  private otherCounts: Record<TOtherCountIndex, TCountRecord> = {} as Record<
    TOtherCountIndex,
    TCountRecord
  >;

  // { [idx: keyof TFsFieldType]: number } = {};

  constructor() {
    super();
    // Initialize otherCounts with all required keys
    this.otherCounts = otherCountIndexes.reduce(
      (acc, key) => {
        acc[key] = { label: key, count: 0, relatedFields: [] };
        return acc;
      },
      {} as Record<TOtherCountIndex, TCountRecord>,
    );
  }

  getRequiredResources(): string[] {
    return ['formModel'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    let isObservationTrue = false;
    const logItems: IObservationLogItem[] = [];
    const uniqueLabel: Record<string, string[]> = {};
    const formModel: IFsModelForm = context.resources.formModel;

    formModel.getFieldIds().forEach((fieldId) => {
      const calcGraph = TreeUtilities.FsCalculationGraphDeep.fromFormModel(
        fieldId,
        formModel,
      );

      if (calcGraph.isEmptyTree()) {
        this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'].relatedFields.push(
          fieldId,
        );
      } else {
        this.otherCounts['_FIELDS_WITH_CALCULATION_'].relatedFields.push(
          fieldId,
        );
      }

      if (calcGraph.getAllErrorNodes().length === 0) {
        this.otherCounts[
          '_FIELDS_WITHOUT_CALCULATION_ERRORS_'
        ].relatedFields.push(fieldId);
      } else {
        this.otherCounts['_FIELDS_WITH_CALCULATION_ERRORS_'].relatedFields.push(
          fieldId,
        );

        calcGraph.getAllErrorNodes().forEach((errorNode) => {
          logItems.push(
            this.createWarnLogItem(context, {
              subjectId: fieldId,
              messageSecondary: errorNode.calcError.message,
              additionalDetails: errorNode.calcError,
              relatedEntityIds: [],
            }),
          );
        });

        const fieldReferences = calcGraph.getUnresolvedFieldReferences();
        fieldReferences.forEach((fieldReference) => {
          const refernceFieldModel =
            formModel.getFieldModelById(fieldReference);
          if (!refernceFieldModel) {
            logItems.push(
              this.createErrorLogItem(context, {
                subjectId: fieldId,
                messageSecondary: `The extended calculation for field '${fieldId}' references a field that does not exist: '${fieldReference}'`,
                relatedEntityIds: [fieldReference],
              }),
            );
          }
        });
      }

      logItems.push(
        this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Calculation graph:`,
          relatedEntityIds: [],
        }),
      );
      // .FsFieldCalculationGraph.fromFormModel(
      //   fieldId,
      //   formModel,
      //   fieldId,
      // );
    }); // end of foreach field loop

    return { isObservationTrue, logItems };
  }
}
export { ObservationMakerCalculationValidation };
