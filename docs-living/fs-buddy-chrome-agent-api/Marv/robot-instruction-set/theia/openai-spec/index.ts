import OpenAI from "openai";
import { fsTheia } from "./fsTheia";
import { fsApiFunctionDefinitionFactory } from "./fsApiFunctionDefinitionFactory";

interface IFsTheiaExternalApi {
  fsTheia: (param: any) => Promise<any>;
}

const fsRestrictedApiFunctionDefinitions = {
  fsTheia: fsApiFunctionDefinitionFactory(fsTheia),
};

Object.entries(fsRestrictedApiFunctionDefinitions).forEach(
  ([fnName, fnDefinition]) => {
    fnDefinition.description =
      "\n  This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.  \n";
  }
);

const fsRestrictedApiFunctionsForOpenApiSpec = Object.entries(
  fsRestrictedApiFunctionDefinitions
).map(([fnName, fnDefinition]) => {
  return {
    type: "function",
    function: fnDefinition,
  } as OpenAI.Beta.Assistant.Function;
});

export { fsRestrictedApiFunctionsForOpenApiSpec };

type IFsTheiaExternalApiFunctionNames = keyof IFsTheiaExternalApi;
export type { IFsTheiaExternalApiFunctionNames };
