export function jsonStringifyBigInt(value: unknown) {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}
