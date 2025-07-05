const TheiaExternalApiFunction1 = {
  type: "object",
  description: `Primary purpose is to manage chat bot conversations.
    This is a stubbed function to support proof-of-concept.
      `,
  properties: {
    // fieldId: { type: "string" },
    label: { type: "string" },
    field_type: { type: "string", default: "text" },
    isHidden: { type: "boolean", default: false },
    isRequired: { type: "boolean", default: false },
  },
  required: ["label", "field_type"],
};
export { TheiaExternalApiFunction1 };
