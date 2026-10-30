import type { Address } from "viem";
import { parseAddress } from "@/lib/deposit";

// Server-side configuration. Each getter throws with the variable name, so a
// missing value shows up in the server log instead of as a vague API error.

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local.`);
  }
  return value;
}

export const serverEnv = {
  get apiBaseUrl() {
    return (
      process.env.TURNKEY_API_BASE_URL?.trim() || "https://api.turnkey.com"
    );
  },
  get organizationId() {
    return requireEnv("NEXT_PUBLIC_ORGANIZATION_ID");
  },
  get daPublicKey() {
    return requireEnv("NEXT_PUBLIC_DA_PUBLIC_KEY");
  },
  get daPrivateKey() {
    return requireEnv("TURNKEY_DA_PRIVATE_KEY");
  },
  get treasury(): Address {
    const treasury = parseAddress(requireEnv("NEXT_PUBLIC_TREASURY_ADDRESS"));
    if (!treasury) {
      throw new Error("NEXT_PUBLIC_TREASURY_ADDRESS is not a valid address.");
    }
    return treasury;
  },
  get sweepEnabled() {
    return process.env.SWEEP_ENABLED?.trim() !== "false";
  },
};
