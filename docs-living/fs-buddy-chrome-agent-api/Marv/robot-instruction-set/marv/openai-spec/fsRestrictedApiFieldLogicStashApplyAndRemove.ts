const fsRestrictedApiFieldLogicStashApplyAndRemove = {
  name: "fsRestrictedApiFieldLogicStashApplyAndRemove",
  description: `
        Applies all field logic then removes the logic cache.

        This is a clean up step to clean up the logic stash.

        This works in conjunction with the logic stash.
        This will only apply logic on fields that have a logic stash.

        Adding/Removing all logic from a form can help to isolate issues with logic.

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
export { fsRestrictedApiFieldLogicStashApplyAndRemove };
