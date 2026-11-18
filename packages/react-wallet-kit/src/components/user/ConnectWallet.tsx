import {
  ExternalWalletSelector,
  WalletSelectorMode,
} from "../auth/wallet/ExternalWalletSelector";
import type { HandleConnectExternalWalletResult } from "../../types/method-types";

interface ConnectWalletModalProps {
  successPageDuration?: number | undefined;
  onSuccess: (result: HandleConnectExternalWalletResult) => void;
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
