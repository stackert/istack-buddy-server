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

  // IFsModelForm,
  //  LogLevel,
} from 'istack-buddy-utilities';

import type { IFsModelForm } from 'istack-buddy-utilities';

class ObservationMakerLogicErrors extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FIELD;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Field Logic Validation Check';

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
      const visibilityTree = TreeUtilities.FsFieldVisibilityGraph.fromFormModel(
        fieldId,
        formModel,
      );

      const logicErrorNodes = visibilityTree.getAllErrorNodes();

      if (logicErrorNodes.length === 0) {
        const logMessage = this.createInfoLogItem(context, {
          subjectId: fieldId,
          messageSecondary: 'No Logic errors found',
          relatedEntityIds: [],
          additionalDetails: undefined, // with the hope expectation that keys with values of 'undefined' will get removed - this is for demonstration only
        });

        logItems.push(logMessage);
      } else {
        isObservationTrue = true;
        logicErrorNodes.forEach((node) => {
          // We  have this little bit of type clean up. we don't want to do "as"
          const errorNode: TFsVisibilityErrorNode =
            node as TFsVisibilityErrorNode;
          const relatedEntityIds = (
            errorNode.logicError.dependencyChainFieldIds || []
          ).map((depItem) => {
            return depItem.directOwnerFieldId;
          });

          const logMessage = this.createWarnLogItem(context, {
            subjectId: fieldId,
            messageSecondary: 'Logic Error found in field',
            relatedEntityIds,
            additionalDetails: errorNode,
          });
          logItems.push(logMessage);
        });
      }
    });

    // const calcSystems = TreeSystems.transformToCalculationSystems(formModel);

    // const calcErrorNodes = TreeCalculations.FsCalculationGraphDeep.getAllErrorNodes(calcSystems);

    return { isObservationTrue: true, logItems };
  }
}

export { ObservationMakerLogicErrors };
