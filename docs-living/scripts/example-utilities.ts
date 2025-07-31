import {
  Models,
  // Transformers,
  // TreeVisibility,
  // TreeCalculations,
  // TreeSystems,
  TreeUtilities,
  ObservationMakers,
} from 'istack-buddy-utilities';
import * as formJson5375703 from '../../test-data/form-json/5375703.json';
import * as formJson6201623 from '../../test-data/form-json/6201623.json';
// import { ObservationMakerCalcErrors } from './ObservationMakerCalcErrors';
// import { ObservationMakerLogicErrors } from './ObservationMakerLogicErrors';
import { ObservationMakerLogicErrors } from './ObservationMakerLogicErrors';
// const x: TreeUtilities.types.TFsFieldVisibilityErrorNode = {};

const formModel5375703 = new Models.FsModelForm(formJson5375703, {
  fieldModelVersion: 'v2',
});
const formModel6201623 = new Models.FsModelForm(formJson6201623, {
  fieldModelVersion: 'v2',
});

// -------------------- Visibility Logic --------------------
const vGraph148456734 = TreeUtilities.FsFieldVisibilityGraph.fromFormModel(
  '148456734',
  formModel5375703,
  '148456734',
);
const visibilityErrorNodes = vGraph148456734.getAllErrorNodes();
const logicSystems =
  TreeUtilities.transformers.transformToLogicSystems(formModel5375703);
const logicCircularSystems =
  TreeUtilities.transformers.transformToCircularLogicSystems(formModel5375703);

console.log({ logicSystems, visibilityErrorNodes, logicCircularSystems });

// -------------------- Calculations --------------------
const calcTree183944855 = TreeUtilities.FsCalculationGraphDeep.fromFormModel(
  '183944855',
  formModel6201623,
);
const calculationErrorNodes = calcTree183944855.getAllErrorNodes();
const calculationSystems =
  TreeUtilities.transformers.transformToCalculationSystems(formModel6201623);

const calculationCircularSystems =
  TreeUtilities.transformers.transformToCircularCalculationSystems(
    formModel6201623,
  );
console.log({
  calculationErrorNodes,
  calculationSystems,
  calculationCircularSystems,
});

// ------------------ Observation Makers Logic Errors ------------------
// '148456734',
//   formModel5375703,
//   '148456734',
// )
(async () => {
  const contextCalc: ObservationMakers.types.IObservationContext = {
    resources: {
      formModel: formModel5375703,
      formConfig: formModel5375703, // We were supposed to fix this?  I think formConfig is only for
      // form related ObservationMakers - and it should rely on form model.
      // logicTrees: logicTrees,
      // calculationTrees: calculationTrees,
    },
  };

  const observationMakerCalc =
    new ObservationMakers.CompositeFormObservationMaker();

  //FieldDebugRawJsonObservationMaker
  observationMakerCalc.addObservationMaker(new ObservationMakerLogicErrors());
  //   observationMaker.addObservationMaker(new ObservationMakerLogicErrors());
  //
  // it should auto populate 'parent' but its not
  // the simpleLog message is still pretty complicated.
  // for fixed values (parent, class, etc) - we should not allow override
  // still have minor type issue (see Observer)
  //
  // Each observation maker should define the message.  This is a static
  // so we can group similar messages.  Secondary message are the more specific

  //
  // we need to use enum for the OM type (form, submitAction, etc)
  //
  // do logic next then fix the above issues. - or not
  //context,
  const observationResultsCalc =
    await observationMakerCalc.makeObservation(contextCalc);

  console.log({ observationResultsCalc });
})();
