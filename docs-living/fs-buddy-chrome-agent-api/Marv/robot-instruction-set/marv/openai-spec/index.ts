import OpenAI from 'openai';
import IFsMarvRestrictedApi from '../../../ApiRequester/fsApi/IFsMarvRestrictedApi';
// import IFsMarvRestrictedApi from "../IFsMarvRestrictedApi";
import { fsApiFunctionDefinitionFactory } from './fsApiFunctionDefinitionFactory';
import { fsRestrictedApiFieldLabelUniqueSlugAdd } from './fsRestrictedApiFieldLabelUniqueSlugAdd';
import { fsRestrictedApiFieldLabelUniqueSlugRemove } from './fsRestrictedApiFieldLabelUniqueSlugRemove';

import { fsRestrictedApiFieldLiteAdd } from './fsRestrictedApiFieldLiteAdd';
import { fsRestrictedApiFieldLogicRemove } from './fsRestrictedApiFieldLogicRemove';
import { fsRestrictedApiFieldLogicStashApply } from './fsRestrictedApiFieldLogicStashApply';
import { fsRestrictedApiFieldLogicStashApplyAndRemove } from './fsRestrictedApiFieldLogicStashApplyAndRemove';
import { fsRestrictedApiFieldLogicStashCreate } from './fsRestrictedApiFieldLogicStashCreate';
import { fsRestrictedApiFieldLogicStashRemove } from './fsRestrictedApiFieldLogicStashRemove';
import { fsRestrictedApiFormDeveloperCopy } from './fsRestrictedApiFormDeveloperCopy';
import { fsRestrictedApiFormLiteAdd } from './fsRestrictedApiFormLiteAdd';

// should be tied to the enum from openapi-spec ?  Tightly coupled??
const fsRestrictedApiFunctionDefinitions = {
  fsRestrictedApiFieldLabelUniqueSlugAdd: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLabelUniqueSlugAdd
  ),
  fsRestrictedApiFieldLabelUniqueSlugRemove: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLabelUniqueSlugRemove
  ),
  fsRestrictedApiFieldLiteAdd: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLiteAdd
  ),
  fsRestrictedApiFieldLogicRemove: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLogicRemove
  ),
  fsRestrictedApiFieldLogicStashApply: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLogicStashApply
  ),
  fsRestrictedApiFieldLogicStashApplyAndRemove: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLogicStashApplyAndRemove
  ),
  fsRestrictedApiFieldLogicStashCreate: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLogicStashCreate
  ),
  fsRestrictedApiFieldLogicStashRemove: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFieldLogicStashRemove
  ),
  fsRestrictedApiFormDeveloperCopy: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFormDeveloperCopy
  ),
  fsRestrictedApiFormLiteAdd: fsApiFunctionDefinitionFactory(
    fsRestrictedApiFormLiteAdd
  ),
};

Object.entries(fsRestrictedApiFunctionDefinitions).forEach(
  ([fnName, fnDefinition]) => {
    fnDefinition.description +=
      '\n  This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.  \n';
  }
);

const fsRestrictedApiFunctionsForOpenApiSpec = Object.entries(
  fsRestrictedApiFunctionDefinitions
).map(([fnName, fnDefinition]) => {
  return {
    type: 'function',
    function: fnDefinition,
  } as OpenAI.Beta.Assistant.Function;
});

// const fsRestrictedApiFunctionsForOpenApiSpec = {
//   type: 'function',
//   function: fsRestrictedApiFormLiteAdd,
// } as OpenAI.Beta.Assistant.Function;
export { fsRestrictedApiFunctionsForOpenApiSpec };

type TFsRestrictedApiFunctionNames = keyof IFsMarvRestrictedApi;
export type { TFsRestrictedApiFunctionNames };
