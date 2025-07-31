import type { TFsFieldType } from 'istack-buddy-utilities';

// Core API response types
type IMarvApiUniversalResponse<T> = {
  isSuccess: boolean;
  response: T | null;
  errorItems: any[] | null;
};

// // Field types for Formstack
// export type TFsFieldType =
//   | 'text'
//   | 'number'
//   | 'datetime'
//   | 'email'
//   | 'phone'
//   | 'address'
//   | 'file'
//   | 'signature'
//   | 'section';

// Form creation response
type TFsLiteFormAddResponse = {
  editUrl: string;
  viewUrl: string;
  isSuccess: boolean;
  formId: string | null;
};

// Field JSON structure
// These should be replaced with the istack-buddy-utilities types
// However, those are not being exported at this time.
type TFsFieldJson = {
  id: string;
  label: string;
  field_type: TFsFieldType;
  hidden?: string;
  require?: string;
  logic?: any;
  default?: string;
  default_value?: string;
};

// Form JSON structure
type TFsFormJson = {
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
};

// Form and related entity overview response
interface IFormAndRelatedEntityOverview {
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

// Available API function names
enum FsRestrictedApiRoutesEnum {
  FieldRemove = 'fieldRemove',
  FieldLabelUniqueSlugAdd = 'fsRestrictedApiFieldLabelUniqueSlugAdd',
  FieldLabelUniqueSlugRemove = 'fsRestrictedApiFieldLabelUniqueSlugRemove',
  FieldLiteAdd = 'fsRestrictedApiFieldLiteAdd',
  FieldLogicRemove = 'fsRestrictedApiFieldLogicRemove',
  FieldLogicStashApply = 'fsRestrictedApiFieldLogicStashApply',
  FieldLogicStashApplyAndRemove = 'fsRestrictedApiFieldLogicStashApplyAndRemove',
  FieldLogicStashCreate = 'fsRestrictedApiFieldLogicStashCreate',
  FieldLogicStashRemove = 'fsRestrictedApiFieldLogicStashRemove',
  FormDeveloperAdd = 'fsRestrictedApiFormDeveloperCopy',
  FormLiteAdd = 'fsRestrictedApiFormLiteAdd',
  FormAndRelatedEntityOverview = 'fsRestrictedApiFormAndRelatedEntityOverview',
  FormLogicValidation = 'fsRestrictedApiFormLogicValidation',
  FormCalculationValidation = 'fsRestrictedApiFormCalculationValidation',
}

type TFsRestrictedApiFunctionNames = keyof typeof FsRestrictedApiRoutesEnum;

// Lite field for simple form creation
interface IAddFsLiteFieldProps {
  label: string;
  field_type: TFsFieldType;
  isHidden?: boolean;
  isRequired?: boolean;
}

export type {
  TFsRestrictedApiFunctionNames,
  TFsFormJson,
  TFsFieldJson,
  IAddFsLiteFieldProps,
  IMarvApiUniversalResponse,
  TFsLiteFormAddResponse,
  IFormAndRelatedEntityOverview,
};

export { FsRestrictedApiRoutesEnum };
