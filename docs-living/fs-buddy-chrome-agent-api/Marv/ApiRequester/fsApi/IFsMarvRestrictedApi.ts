import { TFsFieldJson, TFsFormJson } from "../types-fs-mocks";
import { IAddFsLiteFieldProps } from "./fsRestrictedApi";

// this may not be accurate.  These should return the universal response
interface IFsMarvRestrictedApi {
  fsRestrictedApiFieldLabelUniqueSlugAdd(formId: string): Promise<boolean>;
  fsRestrictedApiFieldLabelUniqueSlugRemove(formId: string): Promise<boolean>;
  fsRestrictedApiFieldLiteAdd(
    formId: string,
    properties: IAddFsLiteFieldProps
  ): Promise<TFsFieldJson>;
  fsRestrictedApiFieldLogicRemove(formId: string): Promise<boolean>;
  fsRestrictedApiFieldLogicStashApply(formId: string): Promise<boolean>;
  fieldLogicStashApplyAndRemove(formId: string): Promise<boolean>;
  fsRestrictedApiFieldLogicStashCreate(formId: string): Promise<boolean>;
  fsRestrictedApiFieldLogicStashRemove(formId: string): Promise<boolean>;
  fsRestrictedApiFormDeveloperCopy(formId: string): Promise<TFsFormJson>;
  fsRestrictedFormLiteAdd(
    formName: string,
    fields: IAddFsLiteFieldProps[]
  ): Promise<TFsFormJson>;
}
export default IFsMarvRestrictedApi;
export type { IFsMarvRestrictedApi };
