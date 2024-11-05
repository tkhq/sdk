"use server"

import crypto from "crypto"

export const generateChallengePair = async (): Promise<{
  verifier: string
  codeChallenge: string
}> => {
  // Step 1: Generate a random 48-character verifier
  const verifier = crypto.randomBytes(32).toString("base64url") // URL-safe Base64 string

  const codeChallenge = await verifierSegmentToChallenge(verifier)

  // Return both the verifier and the codeChallenge to the client
  return { verifier, codeChallenge }
}

export const verifierSegmentToChallenge = async (
  segment: string
): Promise<string> => {
  const salt = process.env.FACEBOOK_SECRET_SALT
  const saltedVerifier = segment + salt

  return crypto.createHash("sha256").update(saltedVerifier).digest("base64url")
}
