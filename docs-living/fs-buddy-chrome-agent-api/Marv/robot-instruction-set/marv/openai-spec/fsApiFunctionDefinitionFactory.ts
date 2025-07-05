interface IfsApiFunctionDefinitionFactoryProps {
  name: string;
  description: string;
  parameters: any;
  responses: any;
}

const defaultNameDescriptionAndParameters = () => {
  return {
    name: '_DEFAULT_FUNCTION_DEFINITION_',
    description: '_DEFAULT_FUNCTION_DEFINITION_',
    parameters: {},
  };
};

const defaultResponse = () => {
  return {
    responses: {
      description: `Generic Response Object for function definitions.
      For successful responses 
          {  
            isSuccessful: true,
            response: any // the response object from the function
            error: null
          }  
           the response body will contain a JSON-encoded representation of the response object.

      For non-successful responses 
           {  
             isSuccessful: false,
             response: null,
             error: any[] // the response object from the function
           }
        `,
      success: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                isSuccessful: { value: true },
                response: { type: 'anything' },
                error: { value: null }, // not sure if that works
              },
            },
          },
        },
      },
      error: {
        description:
          'Create form failed.  Response will include any available error messages.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                isSuccessful: { value: false },
                response: { value: null },
                error: { type: 'anything' }, // not sure if that works
              },
            },
          },
        },
      },
    },
  };
};
const fsApiFunctionDefinitionFactory = (
  overrides: Partial<IfsApiFunctionDefinitionFactoryProps> = {}
) => {
  const functionDefinition = {
    ...defaultNameDescriptionAndParameters(),
    // ...defaultResponse(),
    ...overrides,
  };

  // I thought Assistant API supported  `responses` but it seems to choke on it.
  // it may be that the object has the wrong shape or it's simply not supported.
  // it seems weird to me that I would have added it without testing it.
  // documentation says its supports swagger, so I don't know what is going on.
  // I prefer keep the response object for completeness and figure-out if it's supported or not.
  delete functionDefinition.responses;
  return functionDefinition;
};

export { fsApiFunctionDefinitionFactory };
