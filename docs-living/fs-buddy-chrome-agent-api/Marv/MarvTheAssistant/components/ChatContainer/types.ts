import { ThreadMessage } from "openai/resources/beta/threads/messages/messages";

type TChatMessage = {
  messageId?: string;
  threadId?: string;
  assistantId?: string;
  runId?: string;
  fileIds?: string[];
  role: "user" | "assistant";
  contentText: string;
  created_at: number;
  metadata?: [];
  imageFiles?: {
    base64: null | string;
    type: "image_file";
    fileId: string;
  }[];
};

export { TChatMessage };
