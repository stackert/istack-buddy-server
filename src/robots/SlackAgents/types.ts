type TSlackAgentFunctionDescription = {
  [functionName: string]: {
    shortText: string;
    longText: string;
    parameters: {
      [param: string]: { isRequired: boolean; datatype: string };
    };
    supportedShortCodes: string[];
  };
};

type TKnowledgeBase = {
  knowledgeBaseId: 'core:forms' | 'core:sso-autofill' | 'core:f4sf';
  name: string;
  descriptionShort: string;
  descriptionLong: string;
  channelId: string;
  channelName: '#cx-formstack' | '#forms-sso-autofill' | '#cx-f4sf';
};

export type { TSlackAgentFunctionDescription, TKnowledgeBase };
