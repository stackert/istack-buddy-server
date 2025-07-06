// Core API response types
export interface IMarvApiUniversalResponse<T> {
  isSuccess: boolean;
  response: T | null;
  errorItems: any[] | null;
}

// Field types for Formstack
export type TFsFieldType =
  | 'text'
  | 'number'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'address'
  | 'file'
  | 'signature'
  | 'section';

// Form creation response
export interface TFsLiteFormAddResponse {
  editUrl: string;
  viewUrl: string;
  isSuccess: boolean;
  formId: string | null;
}

// Field JSON structure
export interface TFsFieldJson {
  id: string;
  label: string;
  field_type: TFsFieldType;
  hidden?: string;
  require?: string;
  logic?: any;
  default?: string;
  default_value?: string;
}

// Form JSON structure
export interface TFsFormJson {
  id: string;
  name: string;
  url: string;
  edit_url: string;
  submissions?: number;
  version?: number;
  submissions_today?: number;
  last_submission_id?: string;
  encrypted?: boolean;
  inactive?: boolean;
  timezone?: string;
  should_display_one_question_at_a_time?: boolean;
  has_approvers?: boolean;
  is_workflow_form?: boolean;
  is_workflow_published?: boolean;
  fields?: TFsFieldJson[];
}

// Form and related entity overview response
export interface IFormAndRelatedEntityOverview {
  formId: string;
  submissions: number;
  version: number;
  submissionsToday: number;
  lastSubmissionId: string | null;
  url: string;
  encrypted: boolean;
  isActive: boolean;
  timezone: string;
  isOneQuestionAtATime: boolean;
  hasApprovers: boolean;
  isWorkflowForm: boolean;
  isWorkflowPublished?: boolean; // Only included if isWorkflowForm is true
  fieldCount: number;
  submitActions: Array<{ id: string; name: string }>;
  notificationEmails: Array<{ id: string; name: string }>;
  confirmationEmails: Array<{ id: string; name: string }>;
}
