import Anthropic from '@anthropic-ai/sdk';
import { FsRestrictedApiRoutesEnum } from './types';

// Anthropic tool definitions converted from OpenAI format
const marvToolDefinitions: Anthropic.Messages.Tool[] = [
  {
    name: FsRestrictedApiRoutesEnum.FieldRemove,
    description: `Remove a field from a form by its field ID. This permanently deletes the field and all its data.`,
    input_schema: {
      type: 'object',
      properties: {
        fieldId: {
          type: 'string',
          description: 'The ID of the field to remove',
        },
      },
      required: ['fieldId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FormLiteAdd,
    description: `Create a formstack form. This AI powered form creation tool can create a form based on examples found on the internet.
    The system will help define the form structure (form name and field definitions) and then create the form.
    
    When successful, provides the edit URL, view URL, and form ID.
    
    This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formName: {
          type: 'string',
          description: 'The name for the new form',
        },
        fields: {
          type: 'array',
          description:
            'An array of fields, each should have a label and field_type. The field_type should be one of: text, number, datetime, email, phone, address, signature, file, or section. Field descriptions may include optional properties such as isHidden and isRequired.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label/title for the field',
              },
              field_type: {
                type: 'string',
                description:
                  'Field type: text, number, datetime, email, phone, address, signature, file, or section',
                enum: [
                  'text',
                  'number',
                  'datetime',
                  'email',
                  'phone',
                  'address',
                  'signature',
                  'file',
                  'section',
                ],
              },
              isHidden: {
                type: 'boolean',
                description: 'Whether the field should be hidden from users',
              },
              isRequired: {
                type: 'boolean',
                description: 'Whether the field is required',
              },
            },
            required: ['label', 'field_type'],
          },
        },
      },
      required: ['formName', 'fields'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLiteAdd,
    description: `Adds a field to the current form using simplified syntax. 
    Required properties:
    - label: please use quotes if using spaces or other non-alphanumeric characters
    - field_type: text, number, datetime, email, phone, address, signature, file, or section
    
    Optional properties:
    - isRequired: true or false
    - isHidden: true or false
    
    This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to add the field to',
        },
        label: {
          type: 'string',
          description: 'The label/title for the field',
        },
        field_type: {
          type: 'string',
          description:
            'Field type: text, number, datetime, email, phone, address, signature, file, or section',
          enum: [
            'text',
            'number',
            'datetime',
            'email',
            'phone',
            'address',
            'signature',
            'file',
            'section',
          ],
        },
        isHidden: {
          type: 'boolean',
          description: 'Whether the field should be hidden from users',
        },
        isRequired: {
          type: 'boolean',
          description: 'Whether the field is required',
        },
      },
      required: ['formId', 'label', 'field_type'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugAdd,
    description: `Adds unique slugs to all field labels in a form to make them easier to identify and work with. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to add unique slugs to',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove,
    description: `Removes unique slugs from all field labels in a form. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to remove unique slugs from',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLogicRemove,
    description: `Removes all logic from fields in a form. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to remove logic from',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLogicStashCreate,
    description: `Stashes (saves) all field logic from a form for later restoration. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to stash logic from',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLogicStashApply,
    description: `Applies previously stashed field logic back to a form. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to apply stashed logic to',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove,
    description: `Applies previously stashed field logic back to a form and then removes the stash. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description:
            'The ID of the form to apply and remove stashed logic from',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FieldLogicStashRemove,
    description: `Removes the logic stash from a form without applying it. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to remove the logic stash from',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FormDeveloperAdd,
    description: `Creates a developer copy of a form for testing and development purposes. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to create a developer copy of',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
    description: `Get comprehensive overview of a form including configuration, statistics, and all related entities (webhooks, notifications, confirmations). Provides detailed information about form setup and current status. This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description:
            'Form ID to get overview for, in numeric string format (e.g., "12345")',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FormLogicValidation,
    description: `Validate form field logic and identify potential issues using ObservationMakerLogicValidation.
    
    This tool analyzes form logic and provides:
    - Count of fields with/without logic
    - Logic error detection and reporting
    - Validation of logic checks (predicate fields, operators, values)
    - Detailed error messages for logic issues
    
    Useful for debugging form logic problems and ensuring logic integrity.
    
    This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to validate logic for',
        },
      },
      required: ['formId'],
    },
  },

  {
    name: FsRestrictedApiRoutesEnum.FormCalculationValidation,
    description: `Validate form field calculations and identify potential issues using ObservationMakerCalculationValidation.
    
    This tool analyzes form calculations and provides:
    - Count of fields with/without calculations
    - Calculation error detection and reporting
    - Circular reference detection in calculation dependencies
    - Unresolved field reference validation
    - Detailed error messages for calculation issues
    
    Useful for debugging form calculation problems, identifying circular references, and ensuring calculation integrity.
    
    This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.`,
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description: 'The ID of the form to validate calculations for',
        },
      },
      required: ['formId'],
    },
  },
];

export { marvToolDefinitions };
