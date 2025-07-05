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

// Lite field for simple form creation
export interface IAddFsLiteFieldProps {
  label: string;
  field_type: TFsFieldType;
  isHidden?: boolean;
  isRequired?: boolean;
}

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
}

// Available API function names
export enum FsRestrictedApiRoutesEnum {
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
}

export type TFsRestrictedApiFunctionNames =
  keyof typeof FsRestrictedApiRoutesEnum;
