const fsRestrictedApiFieldLogicStashRemove = {
  name: "fsRestrictedApiFieldLogicStashRemove",
  description: `
        Removes a Logic Stash.

        After a logic cache has been created you can remove or reapply the logic. 
        This is useful for  debugging logic. 

        This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.

        Marv should always indicate to the user the fieldId of the logic stash when removing it.
    `,
  parameters: {
    type: "object",
    properties: {
      formId: { type: "string" },
    },
    required: ["formId"],
  },
};
export { fsRestrictedApiFieldLogicStashRemove };
