import { Keypair } from "@solana/web3.js";
import { decodeUTF8 } from "tweetnacl-util";
import {
  createWalletClient,
  http,
  recoverPublicKey,
  hashMessage,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import type { SolanaWalletInterface, EvmWalletInterface } from "../types";
import nacl from "tweetnacl";
import { ETHEREUM_PRIVATE_KEY, SOLANA_PRIVATE_KEY } from "./constants";
import { WALLET_TYPE_EVM, WALLET_TYPE_SOLANA } from "../constants";

// Mock Solana wallet
export class MockSolanaWallet implements SolanaWalletInterface {
  keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);
  type = WALLET_TYPE_SOLANA;

  async signMessage(message: string): Promise<string> {
    const messageBytes = decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return Buffer.from(signature).toString("hex");
  }

  recoverPublicKey(): string {
    const ed25519PublicKey = Buffer.from(
      this.keypair.publicKey.toBuffer()
    ).toString("hex");
    return ed25519PublicKey;
  }
}

// Mock EVM wallet
export class MockEvmWallet implements EvmWalletInterface {
  account = privateKeyToAccount(ETHEREUM_PRIVATE_KEY);
  type = WALLET_TYPE_EVM;

  async signMessage(message: string): Promise<string> {
    const walletClient = createWalletClient({
      account: this.account,
      chain: mainnet,
      transport: http(),
    });
    const signature = await walletClient.signMessage({
      account: this.account,
      message,
    });
    return signature;
  }

  async recoverPublicKey(message: string, signature: string): Promise<string> {
    const publicKey = recoverPublicKey({
      hash: hashMessage(message),
      signature: signature as Hex,
    });
    return publicKey;
  }
}
