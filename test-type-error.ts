// This file demonstrates the TypeScript type error that should be caught

const otherCountIndexes = [
  '_FIELDS_WITHOUT_CALCULATION_',
  '_FIELDS_WITH_CALCULATION_',
  '_FOUND_CALCULATION_ERRORS_',
] as const;

type TOtherCountIndex = (typeof otherCountIndexes)[number];

type TCountRecord = {
  label: string;
  count: number;
};

// This should be type-safe
const otherCounts: Record<TOtherCountIndex, TCountRecord> =
  otherCountIndexes.reduce(
    (acc, key) => {
      acc[key] = { label: key, count: 0 };
      return acc;
    },
    {} as Record<TOtherCountIndex, TCountRecord>,
  );

// This should cause a TypeScript error - accessing a key not in the array
otherCounts['_FIELDS_WITHOUT_LOGIC_'].count++; // Should be an error!

// This should work fine
otherCounts['_FIELDS_WITHOUT_CALCULATION_'].count++; // Should be OK
