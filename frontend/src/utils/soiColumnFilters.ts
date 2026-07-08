export type ColumnFilters = Record<string, Set<string> | undefined>;

type RecordLike = Record<string, unknown>;

export function cellDisplayValue(record: RecordLike, field: string): string {
  const val = record[field];
  if (val == null || val === '') return '-';
  return String(val);
}

export function uniqueColumnValues(records: RecordLike[], field: string): string[] {
  const values = new Set<string>();
  records.forEach((r) => values.add(cellDisplayValue(r, field)));
  return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function applyColumnFilters<T extends RecordLike>(
  records: T[],
  columnFilters: ColumnFilters,
  fields: string[],
): T[] {
  const activeFields = fields.filter((f) => columnFilters[f] !== undefined);
  if (activeFields.length === 0) return records;

  return records.filter((record) =>
    activeFields.every((field) => {
      const selected = columnFilters[field]!;
      if (selected.size === 0) return false;
      return selected.has(cellDisplayValue(record, field));
    }),
  );
}

export const MARKET_PRICE_FILTER_FIELDS = [
  'Quarter',
  'Country',
  'Cattle_Districts_Live_Min',
  'Cattle_Districts_Live_Max',
  'Cattle_Districts_Live_Avg',
  'Cattle_Districts_Meat_Min',
  'Cattle_Districts_Meat_Max',
  'Cattle_Districts_Meat_Avg',
  'Cattle_Capital_Live_Min',
  'Cattle_Capital_Live_Max',
  'Cattle_Capital_Live_Avg',
  'Cattle_Capital_Meat_Min',
  'Cattle_Capital_Meat_Max',
  'Cattle_Capital_Meat_Avg',
  'Sheep_Districts_Live_Min',
  'Sheep_Districts_Live_Max',
  'Sheep_Districts_Live_Avg',
  'Sheep_Districts_Meat_Min',
  'Sheep_Districts_Meat_Max',
  'Sheep_Districts_Meat_Avg',
  'Sheep_Capital_Live_Min',
  'Sheep_Capital_Live_Max',
  'Sheep_Capital_Live_Avg',
  'Sheep_Capital_Meat_Min',
  'Sheep_Capital_Meat_Max',
  'Sheep_Capital_Meat_Avg',
  'Pig_Districts_Live_Min',
  'Pig_Districts_Live_Max',
  'Pig_Districts_Live_Avg',
  'Pig_Districts_Meat_Min',
  'Pig_Districts_Meat_Max',
  'Pig_Districts_Meat_Avg',
  'Pig_Capital_Live_Min',
  'Pig_Capital_Live_Max',
  'Pig_Capital_Live_Avg',
  'Pig_Capital_Meat_Min',
  'Pig_Capital_Meat_Max',
  'Pig_Capital_Meat_Avg',
] as const;
