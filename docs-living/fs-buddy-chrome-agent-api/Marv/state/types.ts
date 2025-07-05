type TFileCacheItem = {
  fileId: string;
  type: "image_file"; //
  base64: string | null;
  messageId: string;
};

export type { TFileCacheItem };
