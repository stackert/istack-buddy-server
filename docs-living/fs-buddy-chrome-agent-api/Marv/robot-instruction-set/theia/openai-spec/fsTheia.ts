import { FS_FIELD_TYPE_NAMES } from "../../../ApiRequester/types-fs-mocks";

import { TheiaExternalApiFunction1 } from "./TheiaExternalApiFunction1";
const fsTheia = {
  name: "fsTheia",
  description: `
        An API to support the function of supervising robot conversations. 

        Theia's primary purpose is to manage chatbot conversation review.
        Given a recorded conversation (stored text messages) Theia will retrieve 
        analyze and assess the quality of the conversation in terms of 
        customer satisfaction and time-to-resolution.

        Theia analysis will include:
          - a summary of the conversation 3 sentences or less.
          - a numeric score of the conversation. -5 Worst, 0 neutral, 5 Best.

          "-5" will indicate the likeliness that the customer is less satisfied than when they started the conversation.
          "0" will indicate the conversation was neutral. The issue was not resolved but the customer was provided a path forward.
    `,
  parameters: { ...TheiaExternalApiFunction1 },

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
export { fsTheia };
