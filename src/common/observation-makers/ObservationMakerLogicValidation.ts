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
  '_FIELDS_WITH_LOGIC_',
  '_FIELDS_WITHOUT_LOGIC_',
  '_LABEL_HAS_LEADING_OR_TRAILING_WHITESPACE_',
  '_DUPLICATE_LABELS_',
  '_UNIQUE_LABELS_',
] as const;

type TOtherCountIndex = (typeof otherCountIndexes)[number];

const fieldTypes = '';

class ObservationMakerLogicValidation extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FORM;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Field Logic Validation Check';
  private fieldByTypeCounts: Record<TFsFieldType, TCountRecord>;
  private otherCounts: Record<TOtherCountIndex, TCountRecord> = {} as Record<
    TOtherCountIndex,
    TCountRecord
  >;

  // { [idx: keyof TFsFieldType]: number } = {};

  constructor() {
    super();
    this.fieldByTypeCounts = ALL_KNOWN_FS_FIELD_TYPES.reduce(
      (acc, cur) => {
        acc[cur] = {
          count: 0,
          relatedFields: [],
          label: cur,
        };
        return acc;
      },
      {} as Record<TFsFieldType, TCountRecord>,
    );

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
      const fieldModel = formModel.getFieldModelByIdOrThrow(fieldId);

      // Count fields with/out logic
      const logicTree = TreeUtilities.FsFieldVisibilityGraph.fromFormModel(
        fieldId,
        formModel,
        fieldId,
      );

      if (logicTree.isEmptyTree()) {
        this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].relatedFields.push(fieldId);
        return; // no reason to go further if there are no logic
      } else {
        this.otherCounts['_FIELDS_WITH_LOGIC_'].relatedFields.push(fieldId);
      }
    }); // end of foreach field loop

    return { isObservationTrue, logItems };
  }
}
export { ObservationMakerLogicValidation };
