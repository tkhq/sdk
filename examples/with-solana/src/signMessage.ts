import type { TurnkeySigner } from "@turnkey/solana";

/**
 * Sign a message with a Turnkey Solana address.
 * @param signer
 * @param fromAddress
 * @param message
 */
export async function signMessage(input: {
  signer: TurnkeySigner;
  fromAddress: string;
  message: string;
}): Promise<Uint8Array> {
  const { signer, fromAddress, message } = input;
  const messageAsUint8Array = Buffer.from(message);

  const signature = await signer.signMessage(messageAsUint8Array, fromAddress);

  return signature;
}
