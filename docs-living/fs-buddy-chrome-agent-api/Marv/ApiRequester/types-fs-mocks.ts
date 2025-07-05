type TFsFieldType =
  | "address"
  | "checkbox"
  | "creditcard"
  | "datetime"
  | "email"
  | "embed"
  | "file"
  | "matrix"
  | "section"
  | "select"
  | "signature"
  | "text"
  | "textarea"
  | "name"
  | "number"
  | "phone"
  | "product"
  | "radio"
  | "rating"
  | "richtext";

const FS_FIELD_TYPE_NAMES = [
  "address",
  "checkbox",
  "creditcard",
  "datetime",
  "email",
  "embed",
  "file",
  "matrix",
  "section",
  "select",
  "signature",
  "text",
  "textarea",
  "name",
  "number",
  "phone",
  "product",
  "radio",
  "rating",
  "richtext",
];

type TFsFieldJson = {
  label: string;
  field_type: TFsFieldType;
  hidden?: boolean | number | string;
  require?: boolean | number | string;
  default?: string;
  default_value?: string;
  id: string;
  logic?: object | string | null;
  calculation?: object | string | null;
};

type TFsFormJson = {
  url: string;
  id: string | number;
  fields: TFsFieldJson[];
  edit_url: string;
};

type TFsApiError = {};

export type { TFsFormJson, TFsFieldJson, TFsApiError, TFsFieldType };
export { FS_FIELD_TYPE_NAMES };
