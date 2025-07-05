import { fsApiFunctionDefinitionFactory } from './fsApiFunctionDefinitionFactory';

describe('fsApiFunctionDefinitionFactory', () => {
  it('Should create a function definition with all properties overridden.', () => {
    const overrides = {
      name: 'testFunction',
      description: 'This is a test function',
      parameters: { param1: 'value1', param2: 'value2' },
      // responses: {
      //   success: { message: 'Success' },
      //   error: { message: 'Error' },
      // },
    };

    const result = fsApiFunctionDefinitionFactory(overrides);

    expect(result.name).toBe(overrides.name);
    expect(result.description).toBe(overrides.description);
    expect(result.parameters).toEqual(overrides.parameters);
    // expect(result.responses).toEqual(overrides.responses);
    // expect(result).toEqual(OVERRIDE_ALL_PROPERTIES_FUNCTION_DEFINITION());
  });
  it.skip('Should create a default function definition if no property overrides provided.', () => {
    const overrides = undefined;

    const result = fsApiFunctionDefinitionFactory(overrides);

    // expect(result.name).toBe(overrides.name);
    // expect(result.description).toBe(overrides.description);
    // expect(result.parameters).toEqual(overrides.parameters);
    // expect(result.responses).toEqual(overrides.responses);
    // expect(result).toEqual(DEFAULT_EMPTY_FUNCTION_DEFINITION());
  });
});

const OVERRIDE_ALL_PROPERTIES_FUNCTION_DEFINITION = () => {
  return {
    parameters: {
      param1: 'value1',
      param2: 'value2',
    },
    responses: {
      success: {
        message: 'Success',
      },
      error: {
        message: 'Error',
      },
    },
    name: 'testFunction',
    description: 'This is a test function',
  };
};

const DEFAULT_EMPTY_FUNCTION_DEFINITION = () => {
  return {
    name: '_DEFAULT_FUNCTION_DEFINITION_',
    description: '_DEFAULT_FUNCTION_DEFINITION_',
    parameters: {},
    responses: {
      description:
        'Generic Response Object for function definitions.\n      For successful responses \n          {  \n            isSuccessful: true,\n            response: any // the response object from the function\n            error: null\n          }  \n           the response body will contain a JSON-encoded representation of the response object.\n\n      For non-successful responses \n           {  \n             isSuccessful: false,\n             response: null,\n             error: any[] // the response object from the function\n           }\n        ',
      success: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                isSuccessful: {
                  value: true,
                },
                response: {
                  type: 'anything',
                },
                error: {
                  value: null,
                },
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
                isSuccessful: {
                  value: false,
                },
                response: {
                  value: null,
                },
                error: {
                  type: 'anything',
                },
              },
            },
          },
        },
      },
    },
  };
};
