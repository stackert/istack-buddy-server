import { FS_FIELD_TYPE_NAMES } from "../../../ApiRequester/types-fs-mocks";

import { LiteFieldDescription } from "./LiteFieldDescription";
const fsRestrictedApiFieldLiteAdd = {
  name: "fsRestrictedApiFieldLiteAdd",
  description: `
        Adds a field the the current form using simplified syntax (only two required properties). 
          name - pleas use quotes if using spaces or other non alpha numeric characters.
          fieldType - ${FS_FIELD_TYPE_NAMES.join(", ")}
          isRequired - true or false, optional
          isHidden - true or false, optional


        This **CAN ONLY BE DONE ON MARV ENABLED FORMS**.
    `,
  parameters: { ...LiteFieldDescription },
  // parameters: {
  //   type: "object",
  //   description: `A light-weight field should have a title and type. The type should be one of the following: text, number, date, time, email, phone, address, website, file, or section.
  //       Field descriptions may include optional properties such as hidden and required.
  //     `,
  //   properties: {
  //     // fieldId: { type: "string" },
  //     label: { type: "string" },
  //     field_type: { type: "string", default: "text" },
  //     isHidden: { type: "boolean", default: false },
  //     isRequired: { type: "boolean", default: false },
  //   },
  //   required: ["formName", "fields"],
  // },

  responses: {
    success: {
      description: `Successfully created form with the provided fields.  Response will include fieldId and formId.
          
          Successfully added message should include both formId and fieldId.
        `,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              // editUrl: { type: "string" },  maybe put form builder url?
              fieldId: { type: "string" },
              formId: { type: "string" },
            },
          },
        },
      },
    },
    error: {
      description:
        "Create form failed.  Response will include any available error messages.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
  },
};
export { fsRestrictedApiFieldLiteAdd };
