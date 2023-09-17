export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function assertEqual<T>(left: T, right: T) {
  if (left !== right) {
    throw new Error(`${JSON.stringify(left)} !== ${JSON.stringify(right)}`);
  }
}
