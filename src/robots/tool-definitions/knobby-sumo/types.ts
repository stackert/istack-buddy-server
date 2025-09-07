import OpenAI from 'openai';

// Knobby Sumo tool names enum
export enum KnobbySumoToolsEnum {
  SubmitQuery = 'knobby_sumo_submit_query',
  GetJobStatus = 'knobby_sumo_get_job_status',
  GetJobResults = 'knobby_sumo_get_job_results',
  ListJobs = 'knobby_sumo_list_jobs',
  CancelJob = 'knobby_sumo_cancel_job',
  GetQueryList = 'knobby_sumo_get_query_list',
  GetKnownMessages = 'knobby_sumo_get_known_messages',
  GetSubmitActionTypes = 'knobby_sumo_get_submit_action_types',
  GetStatus = 'knobby_sumo_get_status',
  GetFile = 'knobby_sumo_get_file',
  DeleteFile = 'knobby_sumo_delete_file',
  ListFiles = 'knobby_sumo_list_files'
}

// Main tool set type for OpenAI Sumo tools
export type TOpenAIKnobbySumoToolSet = {
  toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[];
  executeToolCall: (toolName: string, toolArgs: any) => Promise<string>;
};
