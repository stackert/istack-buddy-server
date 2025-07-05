type TChatMessage = {
  messageId?: string;
  threadId?: string;
  assistantId?: string;
  runId?: string;
  fileIds?: string[];
  // *tmc* - this is no longer correct.. There should be a type that has a few other roles (error, guest, etc)
  role: 'user' | 'assistant';
  contentText: string;
  created_at: number;
  metadata?: [];
  imageFiles?: {
    base64: null | string;
    type: 'image_file';
    fileId: string;
  }[];
};

export type { TChatMessage };

// you need to check to see if this is the root of all your evil
// dangerouslyAllowBrowser: true
