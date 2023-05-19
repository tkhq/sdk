export function print(header: string, body: string): void {
  const indentedBody = body
    .split("\n")
    .map((line) => `\t${line}`)
    .join("\n");

  console.log(`${header}\n${indentedBody}\n`);
}

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
