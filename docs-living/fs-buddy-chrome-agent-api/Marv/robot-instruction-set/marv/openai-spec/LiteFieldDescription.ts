const LiteFieldDescription = {
  type: 'object',
  description: `A light-weight field should have a title and type. The type should be one of the following: text, number, datetime, email, phone, address, file, signature or section.
        Field descriptions may include optional properties such as hidden and required.
      `,
  properties: {
    // fieldId: { type: "string" },
    label: { type: 'string' },
    field_type: { type: 'string', default: 'text' },
    isHidden: { type: 'boolean', default: false },
    isRequired: { type: 'boolean', default: false },
  },
  required: ['label', 'field_type'],
};
export { LiteFieldDescription };
