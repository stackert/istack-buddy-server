const fsRestrictedApiFieldLogicRemove = {
  name: "fsRestrictedApiFieldLogicRemove",
  description: `
        Removes all field logic from the current form.
        This works in conjunction with the logic stash.
        This will only remove logic on forms that have a logic stash.

        Removing all logic from a form can help to isolate issues with logic.

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
export { fsRestrictedApiFieldLogicRemove };
