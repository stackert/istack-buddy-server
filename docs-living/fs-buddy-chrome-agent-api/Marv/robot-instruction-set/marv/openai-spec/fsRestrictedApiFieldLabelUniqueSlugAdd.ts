const fsRestrictedApiFieldLabelUniqueSlugAdd = {
  name: "fsRestrictedApiFieldLabelUniqueSlugAdd",
  description: `
        This prepends a unique slug to the field label. This is useful for creating a unique label for the field.
        For example, if the field label is "First Name" then the unique slug would be "|1234|First Name".

        This is to verify the label used in logic is the intended field in cases of using duplicate labels.

        This can be reversed by using the apiRestrictedFieldLabelUniqueSlugRemove API.

        This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.
    `,
  parameters: {
    type: "object",
    properties: {
      formId: { type: "string" },
    },
    required: ["formId"],
  },
};
export { fsRestrictedApiFieldLabelUniqueSlugAdd };
