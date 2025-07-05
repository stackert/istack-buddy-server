const formBuilderFunctionSpec = {
  name: 'Marv Form Builder',
  description: `
        Create a formstack form. This AI powered form creation tool can create a form based examples found on the internet.
        Marv will help define the form structure (form name and field definitions) and then create the form.
    `,
  parameters: {
    type: 'object',
    properties: {
      formName: { type: 'string' },
      fields: {
        type: 'array',
        description: `An array of fields, each should have a title and type. The type should be one of the following: text, number, datetime, email, phone, address, file, signature or section.
            Field descriptions may include optional properties such as hidden and required.
          `,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', default: 'text' },
            isHidden: { type: 'boolean', default: false },
            isRequired: { type: 'boolean', default: false },
          },
          required: ['name', 'type'],
        },
      },
    },
    required: ['formName', 'fields'],
  },
};
export { formBuilderFunctionSpec };
