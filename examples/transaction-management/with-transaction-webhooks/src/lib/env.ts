const DEFAULT_BASE_URL = "https://api.turnkey.com";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your .env file.`);
  }

  return value;
}

export const serverEnv = {
  get apiPublicKey() {
    return readRequiredEnv("API_PUBLIC_KEY");
  },
  get apiPrivateKey() {
    return readRequiredEnv("API_PRIVATE_KEY");
  },
  get organizationId() {
    return readRequiredEnv("ORGANIZATION_ID");
  },
  get baseUrl() {
    return process.env.BASE_URL?.trim() || DEFAULT_BASE_URL;
  },
};
