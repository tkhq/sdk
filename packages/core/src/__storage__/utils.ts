export function parseStorageValue(item: string | null): any {
  if (!item) return undefined;

  try {
    return JSON.parse(item);
  } catch {
    // An unparseable value is treated as absent by both storage managers.
    return undefined;
  }
}
