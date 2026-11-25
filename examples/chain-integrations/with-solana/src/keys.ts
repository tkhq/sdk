import * as fs from "fs";
import * as path from "path";

// API keys for the demo users this example creates in your organization.
// They are generated locally by `pnpm generate-keys` and stored in
// `keys.local.json`, which is gitignored. Never commit that file.
const KEYS_FILE = path.resolve(process.cwd(), "keys.local.json");

if (!fs.existsSync(KEYS_FILE)) {
  throw new Error(
    `Missing ${KEYS_FILE}. Run \`pnpm generate-keys\` to create the demo API keys first.`,
  );
}

const keys: { [key: string]: { [key: string]: string } } = JSON.parse(
  fs.readFileSync(KEYS_FILE, "utf8"),
);

export default keys;
