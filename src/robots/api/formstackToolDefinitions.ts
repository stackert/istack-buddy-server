import Anthropic from '@anthropic-ai/sdk';

// Anthropic tool definitions converted from OpenAI format
export const formstackToolDefinitions: Anthropic.Messages.Tool[] = [
  {
    name: 'fieldRemove',
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
    name: 'fsRestrictedApiFormLiteAdd',
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
    name: 'fsRestrictedApiFieldLiteAdd',
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
    name: 'fsRestrictedApiFieldLabelUniqueSlugAdd',
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
    name: 'fsRestrictedApiFieldLabelUniqueSlugRemove',
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
    name: 'fsRestrictedApiFieldLogicRemove',
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
    name: 'fsRestrictedApiFieldLogicStashCreate',
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
    name: 'fsRestrictedApiFieldLogicStashApply',
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
    name: 'fsRestrictedApiFieldLogicStashApplyAndRemove',
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
    name: 'fsRestrictedApiFieldLogicStashRemove',
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
    name: 'fsRestrictedApiFormDeveloperCopy',
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
];
