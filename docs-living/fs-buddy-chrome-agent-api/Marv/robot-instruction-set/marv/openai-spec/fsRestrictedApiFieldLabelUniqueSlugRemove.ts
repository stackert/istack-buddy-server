const fsRestrictedApiFieldLabelUniqueSlugRemove = {
  name: "fsRestrictedApiFieldLabelUniqueSlugRemove",
  description: `
        This removes a unique label slug prepended to the field label.

        Unique label slugs are used to help identify fields in logic when duplicate labels exit. 

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
export { fsRestrictedApiFieldLabelUniqueSlugRemove };
