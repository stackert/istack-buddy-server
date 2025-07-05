import { filterMarvEnabledFields, isMarvEnabledFormJson } from './functions';
import { TFsFieldJson } from '../types-fs-mocks';

describe('filterMarvEnabledFields', () => {
  it('Should return an empty array when no fields are provided.', () => {
    const formJson = { fields: [] };
    const result = filterMarvEnabledFields(formJson);
    expect(result).toEqual([]);
  });
  it('Should return an empty array when parameters are wrong type.', () => {
    expect(filterMarvEnabledFields({ fields: [] })).toEqual([]);

    // @ts-ignore - test if array for TFsFieldJson is handled
    expect(filterMarvEnabledFields({ fields: [[]] })).toEqual([]);

    // @ts-ignore - test if primitive types for TFsFieldJson is handled
    expect(filterMarvEnabledFields({ fields: [1, 'two', new Date()] })).toEqual(
      []
    );
    // @ts-ignore - test if undefined for TFsFormJson is handled
    expect(filterMarvEnabledFields()).toEqual([]);
    // @ts-ignore - test if empty array for TFsFormJson is handled
    expect(filterMarvEnabledFields([])).toEqual([]);

    expect(
      // @ts-ignore - test if object without 'fields' property for TFsFormJson is handled
      filterMarvEnabledFields({ notFields: 'This is not a field' })
    ).toEqual([]);
  });
  it('Should return empty array if no marv enabled fields found.', () => {
    const formJson = {
      fields: [
        { id: '1', label: 'field1', field_type: 'text' },
        { id: '2', label: 'field2', field_type: 'text' },
      ] as TFsFieldJson[],
    };
    const result = filterMarvEnabledFields(formJson);
    expect(result).toEqual([]);
  });
  it('Should array of all marv enable fields.', () => {
    const expectedMarvEnabledFields = [
      {
        id: '5',
        label: 'MARV_ENABLED',
        field_type: 'text',
        default: 'MARV_ENABLED',
      },
      {
        id: '5',
        label: 'SOME_STUFF_MARV_ENABLED',
        field_type: 'text',
        default: 'MARV_ENABLED',
      },
    ];
    const formJson = {
      fields: mockFieldCollectionWithMarvEnabledFields,
    };
    const result = filterMarvEnabledFields(formJson);
    expect(result).toEqual(expectedMarvEnabledFields);
  });
});

describe('isMarvEnabledFormJson', () => {
  it('Should return true when at least one field is Marv enabled.', () => {
    expect(
      isMarvEnabledFormJson({
        fields: [
          { id: '1', label: 'field1', field_type: 'text' },
          { id: '2', label: 'field2', field_type: 'text' },
        ] as TFsFieldJson[],
      })
    ).toBe(false);
    expect(
      isMarvEnabledFormJson({
        fields: [
          // not all caps
          { id: '2', label: 'marv_enabled', field_type: 'text' },
        ] as TFsFieldJson[],
      })
    ).toBe(false);
    expect(
      isMarvEnabledFormJson({
        fields: [
          {
            id: '2',
            label: 'field2',
            field_type: 'text',
            default: 'marv_enabled',
          },
        ] as TFsFieldJson[],
      }) // not capitalized
    ).toBe(false);
    expect(
      isMarvEnabledFormJson({
        fields: [
          {
            id: '2',
            label: 'field2',
            field_type: 'text',
            default: ' marv_enabled',
          },
        ] as TFsFieldJson[],
      }) // leading/trailing space
    ).toBe(false);
    expect(
      isMarvEnabledFormJson({
        fields: [] as TFsFieldJson[],
      })
    ).toBe(false);
    expect(
      isMarvEnabledFormJson({
        // @ts-ignore - test if object with undefined 'fields' property is handled
        fields: undefined,
      })
    ).toBe(false);
    // @ts-ignore - test if object without 'fields' property is handled
    expect(isMarvEnabledFormJson({})).toBe(false);

    // @ts-ignore - test if undefined is handled
    expect(isMarvEnabledFormJson(undefined)).toBe(false);
    //
  });

  it('Should return false when no field is Marv enabled.', () => {
    const formJson = {
      fields: [
        { id: '1', label: 'field1', field_type: 'text' },
        { id: '2', label: 'field2', field_type: 'text' },
      ] as TFsFieldJson[],
    };
    const result = isMarvEnabledFormJson(formJson);
    expect(result).toBe(false);
  });
});

const mockFieldCollectionWithMarvEnabledFields = [
  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
  { id: '2', label: 'field2', field_type: 'text' },
  {
    id: '3',
    label: 'field3',
    field_type: 'text',
    default: 'MARV_ENABLED',
  },
  { id: '4', label: 'field1', field_type: 'text' },
  {
    id: '5',
    label: 'MARV_ENABLED',
    field_type: 'text',
    default: 'MARV_ENABLED',
  },
  {
    id: '6',
    label: 'marv_enabled ',
    field_type: 'text',
    default: 'marv_enabled',
  },
  {
    id: '7',
    label: ' marv_enabled',
    field_type: 'text',
    default: 'marv_enabled',
  },
  {
    id: '8',
    label: 'TextBeforeMarv_enabledTextAfter',
    field_type: 'text',
  },
  {
    id: '5',
    label: 'SOME_STUFF_MARV_ENABLED',
    field_type: 'text',
    default: 'MARV_ENABLED',
  },
] as TFsFieldJson[];
