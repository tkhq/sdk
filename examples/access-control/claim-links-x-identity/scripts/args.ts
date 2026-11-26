// pnpm forwards the `--` separator through to the script, so `pnpm demo -- turnkey:123`
// arrives as ["--", "turnkey:123"]. Strip it so documented invocations work.
export function scriptArgs(): string[] {
  return process.argv.slice(2).filter((arg) => arg !== "--");
}
