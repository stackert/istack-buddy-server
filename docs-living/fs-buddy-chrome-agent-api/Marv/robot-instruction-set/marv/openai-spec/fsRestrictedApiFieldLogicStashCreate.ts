import { FS_FIELD_TYPE_NAMES } from "../../../ApiRequester/types-fs-mocks";

const fsRestrictedApiFieldLogicStashCreate = {
  name: "fsRestrictedApiFieldLogicStashCreate",
  description: `
        Creates a Logic Stash.
        A logic stash is a copy of the logic that is currently applied to a form and stored
        on the form as a field.  All the logic can be copied and reviewed in a single field.
        The logic can not be updated and if the stash altered in any way the logic can not be restored.
        (Hence look but do not change)

        After a logic cache has been created you can remove or reapply the logic. 
        This is useful for  debugging logic. 

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
export { fsRestrictedApiFieldLogicStashCreate };
