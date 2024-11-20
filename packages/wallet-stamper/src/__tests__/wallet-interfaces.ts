import { Keypair } from "@solana/web3.js";
import { decodeUTF8 } from "tweetnacl-util";

import { type SolanaWalletInterface, WalletType } from "../types";
import nacl from "tweetnacl";
import { SOLANA_PRIVATE_KEY } from "./constants";

// Mock Solana wallet
export class MockSolanaWallet implements SolanaWalletInterface {
  keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);
  type: WalletType.Solana = WalletType.Solana;

  async signMessage(message: string): Promise<string> {
    const messageBytes = decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return Buffer.from(signature).toString("hex");
  }

  async getPublicKey(): Promise<string> {
    const ed25519PublicKey = Buffer.from(
      this.keypair.publicKey.toBuffer()
    ).toString("hex");
    return ed25519PublicKey;
  }
}
