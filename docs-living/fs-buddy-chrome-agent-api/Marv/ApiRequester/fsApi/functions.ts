import { TFsFieldJson } from '../types-fs-mocks';
import { isFunctions } from '../../../common/isFunctions';

interface isMarvEnabledProps {
  fields: TFsFieldJson[];
}
const filterMarvEnabledFields = (
  formJson: isMarvEnabledProps = { fields: [] }
): TFsFieldJson[] => {
  if (!formJson.fields || !Array.isArray(formJson.fields)) {
    return [];
  }

  return (formJson.fields || []).filter((field) => {
    const label = field.label || '';
    const defaultVal = field.default || '';

    if (!isFunctions.isString(defaultVal) || !isFunctions.isString(label)) {
      return false;
    }

    return (
      label.trim().match(/MARV_ENABLED/) && defaultVal.trim() === 'MARV_ENABLED'
    );
  });
};

const isMarvEnabledFormJson = (formJson: isMarvEnabledProps): boolean => {
  return filterMarvEnabledFields(formJson).length > 0;
};

export { filterMarvEnabledFields, isMarvEnabledFormJson };
