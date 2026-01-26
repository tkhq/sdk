import type { WalletAccount } from "@turnkey/core";
import {
  ExternalWalletSelector,
  WalletSelectorMode,
} from "../auth/wallet/ExternalWalletSelector";

interface ConnectWalletModalProps {
  successPageDuration?: number | undefined;
  onSuccess: (type: "connect" | "disconnect", account: WalletAccount) => void;
}

export function ConnectWalletModal(props: ConnectWalletModalProps) {
  const { successPageDuration, onSuccess } = props;

  return (
    <ExternalWalletSelector
      mode={WalletSelectorMode.Connect}
      onSuccess={onSuccess}
      successPageDuration={successPageDuration}
    />
  );
}
