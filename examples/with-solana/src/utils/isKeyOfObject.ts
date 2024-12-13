// isKeyOfObject checks if a key exists within an object
export function isKeyOfObject<T>(
  key: string | number | symbol | undefined,
  obj: any
): key is keyof T {
  if (!key) return false;

  return key in obj;
}
