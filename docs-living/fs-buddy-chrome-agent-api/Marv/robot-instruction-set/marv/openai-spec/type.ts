type TExternalAPIFunctionOpenAiDefinitions = {
  name: string; // I use machine friendly names (pascal case) for the name
  description: string;
  parameters: {
    type: string;
    properties: any;
    required: string[];
  };
};

export type { TExternalAPIFunctionOpenAiDefinitions };
