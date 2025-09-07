import {
  ObservationMakers,
  TreeUtilities,
  EObservationSubjectType,
  EObservationClass,
  EObservationResource,
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

class ObservationMakerFieldCounts extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FORM;
  protected observationClass = this.constructor.name;
  protected observationClassName =
    'ObservationMakerFieldCounts' as EObservationClass;
  protected messagePrimary = 'Field Counts Observation';
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

  getRequiredResources(): EObservationResource[] {
    return ['formModel' as EObservationResource];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    const isObservationTrue = false;
    const logItems: IObservationLogItem[] = [];
    const uniqueLabel: Record<string, string[]> = {};
    const formModel: IFsModelForm = context.resources.formModel;

    formModel.getFieldIds().forEach((fieldId) => {
      const fieldModel = formModel.getFieldModelByIdOrThrow(fieldId);

      try {
        this.fieldByTypeCounts[
          fieldModel.getFieldType() as TFsFieldType
        ].relatedFields.push(fieldId);
      } catch (error) {
        const fType = fieldModel.getFieldType();
        const logItem: IObservationLogItem = this.createWarnLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Field type ${fType} not supported.`,
          relatedEntityIds: [],
        });
        logItems.push(logItem);
      }

      // Count fields with/out calcualtions
      const shallowTree =
        TreeUtilities.FsCalculationGraphShallow.fromCalcStringJson(
          fieldId,
          fieldModel.getCalculationString() || '',
        );

      if (!shallowTree) {
        this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'].relatedFields.push(
          fieldId,
        );
      } else {
        this.otherCounts['_FIELDS_WITH_CALCULATION_'].relatedFields.push(
          fieldId,
        );
      }

      // Count fields with/out logic
      const logicTree = TreeUtilities.FsFieldVisibilityGraph.fromFormModel(
        fieldId,
        formModel,
        fieldId,
      );

      if (logicTree.isEmptyTree()) {
        this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].relatedFields.push(fieldId);
      } else {
        this.otherCounts['_FIELDS_WITH_LOGIC_'].relatedFields.push(fieldId);
      }

      // count fields with leading/trailing whitespace in label
      if (
        fieldModel.labelUserFriendly().trim() != fieldModel.labelUserFriendly()
      ) {
        this.otherCounts[
          '_LABEL_HAS_LEADING_OR_TRAILING_WHITESPACE_'
        ].relatedFields.push(fieldId);
      }

      // count unique labels
      const label = fieldModel.labelUserFriendly();
      if (!uniqueLabel[fieldModel.labelUserFriendly()]) {
        uniqueLabel[fieldModel.labelUserFriendly()] = [fieldId];
      } else {
        uniqueLabel[fieldModel.labelUserFriendly()].push(fieldId);
      }
    }); // end of foreach field loop

    Object.entries(uniqueLabel).forEach(([label, fieldIds]) => {
      if (fieldIds.length > 1) {
        const logItem: IObservationLogItem = this.createWarnLogItem(context, {
          subjectId: 'form',
          messageSecondary: `Non unique lable used ${fieldIds.length} times: '${label.substring(0, 50)}...'`,
          relatedEntityIds: fieldIds,
        });
        logItems.push(logItem);
      }
    });

    if (
      this.otherCounts['_LABEL_HAS_LEADING_OR_TRAILING_WHITESPACE_']
        .relatedFields.length > 0
    ) {
      const logItem: IObservationLogItem = this.createWarnLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Label has leading or trailing whitespace`,
        relatedEntityIds:
          this.otherCounts['_LABEL_HAS_LEADING_OR_TRAILING_WHITESPACE_']
            .relatedFields,
      });
      logItems.push(logItem);
    } else {
      const logItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Found no labels with leading or trailing whitespace.`,
        relatedEntityIds: [],
      });
      logItems.push(logItem);
    }

    // _FIELDS_WITH_CALCULATION_
    if (
      this.otherCounts['_FIELDS_WITH_CALCULATION_'].relatedFields.length > 0
    ) {
      const fieldsWithCalculations =
        this.otherCounts['_FIELDS_WITH_CALCULATION_'].relatedFields;
      const logItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Fields without calculations: ${fieldsWithCalculations.length}.`,
        relatedEntityIds: fieldsWithCalculations,
      });
      logItems.push(logItem);
    }

    // _FIELDS_WITHOUT_CALCULATION_
    if (
      this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'].relatedFields.length > 0
    ) {
      const fieldsWithoutCalculations =
        this.otherCounts['_FIELDS_WITHOUT_CALCULATION_'].relatedFields;
      const logItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Fields without calculations: ${fieldsWithoutCalculations.length}.`,
        relatedEntityIds: fieldsWithoutCalculations,
      });
      logItems.push(logItem);
    }

    // _FIELDS_WITH_LOGIC_
    if (this.otherCounts['_FIELDS_WITH_LOGIC_'].relatedFields.length > 0) {
      const fieldsWithLogic =
        this.otherCounts['_FIELDS_WITH_LOGIC_'].relatedFields;
      const logItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Fields with logic: ${fieldsWithLogic.length}.`,
        relatedEntityIds: fieldsWithLogic,
      });
      logItems.push(logItem);
    }

    // _FIELDS_WITHOUT_LOGIC_
    if (this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].relatedFields.length > 0) {
      const fieldsWithoutLogic =
        this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].relatedFields;
      const logItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: formModel.formId,
        messageSecondary: `Fields without logic: ${fieldsWithoutLogic.length}.`,
        relatedEntityIds: fieldsWithoutLogic,
      });
      logItems.push(logItem);
    }

    const allFieldCountLogItems: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: formModel.formId,
        messageSecondary: `Total number of fields on form: ${formModel.getFieldIds().length}`,
        relatedEntityIds: [],
      },
    );
    logItems.push(allFieldCountLogItems);

    return { logItems };
  }
}
export { ObservationMakerFieldCounts };
