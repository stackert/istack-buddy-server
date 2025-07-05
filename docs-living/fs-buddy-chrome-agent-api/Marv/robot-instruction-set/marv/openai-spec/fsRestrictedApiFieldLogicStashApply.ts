import { FS_FIELD_TYPE_NAMES } from "../../../ApiRequester/types-fs-mocks";

const fsRestrictedApiFieldLogicStashApply = {
  name: "fsRestrictedApiFieldLogicStashApply",
  description: `
        Applies all field logic from the logic stash back on to individual fields (restores logic remove).

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
export { fsRestrictedApiFieldLogicStashApply };
