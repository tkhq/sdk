/** Test-only client: its disposable private key stays in this process. */
export async function softwareClient() {
  const keys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  const calls = [];
  return {
    publicKey: keys.publicKey,
    calls,
    client: {
      async signRawPayload(input) {
        calls.push(input);
        if (
          input.encoding !== "PAYLOAD_ENCODING_HEXADECIMAL" ||
          input.hashFunction !== "HASH_FUNCTION_NOT_APPLICABLE"
        )
          throw new Error(
            "The software fixture requires exact raw Ed25519 bytes.",
          );
        const signature = Buffer.from(
          await crypto.subtle.sign(
            "Ed25519",
            keys.privateKey,
            Buffer.from(input.payload, "hex"),
          ),
        ).toString("hex");
        return {
          r: signature.slice(0, 64),
          s: signature.slice(64),
          activity: {
            id: "offline-software-signature",
            status: "ACTIVITY_STATUS_COMPLETED",
          },
        };
      },
    },
  };
}
