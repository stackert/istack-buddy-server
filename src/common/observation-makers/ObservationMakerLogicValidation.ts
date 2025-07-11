import { log } from 'console';
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
  IFsModelField,
} from 'istack-buddy-utilities';

type TCountRecord = {
  label: string;
  count: number;
  relatedFields: string[];
};

const otherCountIndexes = [
  '_FIELDS_WITH_LOGIC_',
  '_FIELDS_WITHOUT_LOGIC_',
  '_FIELDS_WITH_LOGIC_ERRORS_',
  '_FIELDS_WITHOUT_LOGIC_ERRORS_',
] as const;

type TOtherCountIndex = (typeof otherCountIndexes)[number];

const fieldTypes = '';

class ObservationMakerLogicValidation extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FIELD;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Field Logic Validation Check';
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

    // much of this function should be moved/refactored
    // this validates Logic on a field.  It should validate logic on all logic-able things: integrations, field, emails, etc.

    formModel.getFieldIds().forEach((fieldId) => {
      const fieldModel = formModel.getFieldModelById(fieldId) as IFsModelField;
      if (!fieldModel) {
        logItems.push(
          this.createErrorLogItem(context, {
            subjectId: fieldId,
            messageSecondary: `Field model not found for logic check: ${fieldId}`,
            relatedEntityIds: [],
          }),
        );
        return;
      }

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

      if (logicTree.getAllErrorNodes().length > 0) {
        this.otherCounts['_FIELDS_WITH_LOGIC_ERRORS_'].relatedFields.push(
          fieldId,
        );
        logicTree.getAllErrorNodes().forEach((errorNode) => {
          logItems.push(
            this.createWarnLogItem(context, {
              subjectId: fieldId,
              messageSecondary: `Logic error: ${errorNode.logicError.message}`,
              additionalDetails: errorNode.logicError,
              relatedEntityIds: [],
            }),
          );
        });
      } else {
        this.otherCounts['_FIELDS_WITHOUT_LOGIC_ERRORS_'].relatedFields.push(
          fieldId,
        );
      }

      // check logic statement predicate fieldIds are valid

      const ownLogic = fieldModel.getLogicOwn();
      if (ownLogic && ownLogic.checks) {
        (ownLogic.checks || []).forEach((check) => {
          const {
            fieldId: predicateFieldId,
            condition: operator,
            option: value,
          } = check;
          [predicateFieldId, operator].forEach((predicsteElement) => {
            if (predicsteElement === null || predicsteElement === undefined) {
              logItems.push(
                this.createWarnLogItem(context, {
                  subjectId: fieldId,
                  messageSecondary: `Check appears invalid -one or more elements are not defined: '${JSON.stringify(check)}'`,
                  additionalDetails: check,
                  relatedEntityIds: [predicateFieldId],
                }),
              );
            }
          });

          if (!value) {
            logItems.push(
              this.createWarnLogItem(context, {
                subjectId: fieldId,
                messageSecondary: `Using empty value for check - is not considered best practice: '${JSON.stringify(check)}'`,
                additionalDetails: check,
                relatedEntityIds: [predicateFieldId],
              }),
            );
          }

          // check fieldIds exists
          const predicateFieldModel =
            formModel.getFieldModelById(predicateFieldId);
          if (!predicateFieldModel) {
            logItems.push(
              this.createErrorLogItem(context, {
                subjectId: predicateFieldId,
                messageSecondary: `Predicate fieldId does not exist: ${predicateFieldId}`,
                additionalDetails: check,
                relatedEntityIds: [predicateFieldId, fieldId],
              }),
            );
          }
        });
      }

      // -- other counts
      logItems.push(
        this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Number of fields with logic: ${this.otherCounts['_FIELDS_WITH_LOGIC_'].count}`,
          // additionalDetails: this.otherCounts,
          relatedEntityIds:
            this.otherCounts['_FIELDS_WITH_LOGIC_'].relatedFields,
        }),
      );

      logItems.push(
        this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Number of fields without logic: ${this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].count}`,
          // additionalDetails: this.otherCounts,
          relatedEntityIds:
            this.otherCounts['_FIELDS_WITHOUT_LOGIC_'].relatedFields,
        }),
      );

      logItems.push(
        this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Number of fields with logic errors: ${this.otherCounts['_FIELDS_WITH_LOGIC_ERRORS_'].count}`,
          // additionalDetails: this.otherCounts,
          relatedEntityIds:
            this.otherCounts['_FIELDS_WITH_LOGIC_ERRORS_'].relatedFields,
        }),
      );

      logItems.push(
        this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: `Number of fields without logic errors: ${this.otherCounts['_FIELDS_WITHOUT_LOGIC_ERRORS_'].count}`,
          // additionalDetails: this.otherCounts,
          relatedEntityIds:
            this.otherCounts['_FIELDS_WITHOUT_LOGIC_ERRORS_'].relatedFields,
        }),
      );
    }); // end of foreach field loop

    // we need to add loging for this.otherCounts

    return { isObservationTrue, logItems };
  }
}
export { ObservationMakerLogicValidation };
