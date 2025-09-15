import type { v1Attestation } from "@turnkey/sdk-types";

export type CreatePasskeyParams = {
  name?: string;
  challenge?: string;
};

export type CreatePasskeyResult = {
  attestation: v1Attestation;
  encodedChallenge: string;
};
