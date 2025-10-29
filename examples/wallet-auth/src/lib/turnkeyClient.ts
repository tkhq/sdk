// lib/turnkeyClient.ts
import { TurnkeyClient } from "@turnkey/core";

export const turnkey = new TurnkeyClient({
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!, // must be defined
});

// Initialize once. Safe to call multiple times; subsequent calls are no-ops.
void turnkey.init();
