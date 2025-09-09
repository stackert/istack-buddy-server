export interface MessageQueueJobData {
  messageId: string;
  userId: string;
  content: any;
  priority?: number;
  delay?: number;
}

export interface FileProcessingJobData {
  fileId: string;
  userId: string;
  operation: 'metadata-extraction';
  filePath?: string;
  priority?: number;
  delay?: number;
}

export interface NotificationJobData {
  userId: string;
  intent: string;
  data: Record<string, any>;
  priority?: number;
  delay?: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export type {
  MessageQueueJobData,
  FileProcessingJobData,
  NotificationJobData,
  QueueStats,
};
