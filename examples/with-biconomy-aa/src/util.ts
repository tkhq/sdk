export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function assertEqual<T>(left: T, right: T) {
  if (left !== right) {
    throw new Error(`${JSON.stringify(left)} !== ${JSON.stringify(right)}`);
  }
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
