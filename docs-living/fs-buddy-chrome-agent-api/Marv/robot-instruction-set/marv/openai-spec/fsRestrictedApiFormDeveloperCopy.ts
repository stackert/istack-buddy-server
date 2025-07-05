const fsRestrictedApiFormDeveloperCopy = {
  name: "fsRestrictedApiFormDeveloperCopy",
  description: `
        Will copy the current form and all of its fields and logic to a test form.

        This is good for debugging the form to avoid any changes to the live form.

        In most cases an issue with a form will be copied with the form.  However, not all issues are form related.

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
export { fsRestrictedApiFormDeveloperCopy };
