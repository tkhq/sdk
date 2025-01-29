import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import {
  type SolanaWalletInterface,
  WalletType,
} from "@turnkey/wallet-stamper";

export function useSolanaStamper() {
  const { publicKey, signMessage } = useWallet();

  const solanaStamper = useMemo<SolanaWalletInterface | null>(() => {
    if (!publicKey || !signMessage) {
      return null;
    }

    return {
      signMessage: async (message: string) => {
        const signedMessage = await signMessage(Buffer.from(message));
        return Buffer.from(signedMessage).toString("hex");
      },
      getPublicKey: async () => {
        console.log("getPublicKey", publicKey);
        return Buffer.from(publicKey.toBuffer()).toString("hex");
      },
      type: WalletType.Solana,
    };
  }, [publicKey, signMessage]);

  return { solanaStamper };
}
