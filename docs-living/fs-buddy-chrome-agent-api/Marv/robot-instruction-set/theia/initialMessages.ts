import { TChatMessage } from "../../MarvTheAssistant/components/ChatContainer/types";

const initialMessagesDebugState: TChatMessage[] = [
  {
    messageId: Date.now() + "",
    contentText: `Hello Theia
          We are going to start a new help session.
          Please introduce yourself to the user and explain what your capabilities.
        `,
    role: "user",
    created_at: Math.floor(Date.now() / 1000),
  },
  {
    messageId: Date.now() + 1 + "",
    contentText: `This message should have a file attached`,
    role: "assistant",
    created_at: Math.floor(Date.now() / 1000),
    imageFiles: [
      {
        base64: null,
        type: "image_file",
        fileId: "file-JHDCk8EXfF3KqZ2bRN8GDaps",
      },
    ],
  },
  {
    messageId: "msg_E9VlDbBdCBBs8ImV9zvP7g0q",
    contentText:
      "Here is the graph of the function \\( f(x) = x^2 \\) with the x-axis ranging from -1 to 10. The y-axis automatically adjusts to the range of values that \\( f(x) \\) takes within the given x-axis range.",
    role: "assistant",
    created_at: 1706510643,
    imageFiles: [
      {
        base64: null,
        type: "image_file",
        fileId: "file-z4osWHyNxT8VB8mcuf1VvuY1",
      },
    ],
  },
];
const gold_initialMessagesDebugState: TChatMessage[] = [
  {
    messageId: "2",
    contentText: `Hello Marv
          We are going to start a new help session.
          Please introduce yourself to the user and explain what your capabilities.
        `,
    role: "user",
    created_at: Math.floor(Date.now() / 1000),
  },
  {
    messageId: "2",
    contentText: "assistantInitialMessages.longText",
    role: "assistant",
    created_at: Math.floor(Date.now() / 1000) + 1,
  },
  {
    messageId: "3",
    contentText: `Hello Marv
          We are going to start a new help session.
          Please introduce yourself to the user and explain what your capabilities.
        `,
    role: "user",
    created_at: Math.floor(Date.now() / 1000) + 2,
  },
  {
    messageId: "4",
    contentText: "assistantInitialMessages.longText",
    role: "assistant",
    created_at: Math.floor(Date.now() / 1000) + 3,
  },
];

export {
  initialMessagesDebugState,
  initialMessagesDebugState as initialMessages,
  gold_initialMessagesDebugState,
};
