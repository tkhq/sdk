import {
  ExternalWalletSelector,
  DisconnectWalletScreen,
  WalletConnectScreen,
} from "../auth/Wallet";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";
import type { WalletProvider } from "@turnkey/core";
import { isWalletConnect } from "../../utils/utils";

interface ConnectWalletModalProps {
  providers: WalletProvider[];
  successPageDuration?: number | undefined;
  onSuccess: () => void;
  onError: (error: any) => void;
}
export function ConnectWalletModal(props: ConnectWalletModalProps) {
  const { providers, successPageDuration, onSuccess, onError } = props;
  const { pushPage, closeModal } = useModal();
  const { connectWalletAccount, disconnectWalletAccount } = useTurnkey();

  const handleConnectWallet = async (provider: WalletProvider) => {
    if (isWalletConnect(provider)) {
      // for WalletConnect we route to a dedicated screen
      // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
      pushPage({
        key: "Connect WalletConnect",
        content: (
          <WalletConnectScreen
            provider={provider}
            onAction={connectWalletAccount}
            successPageDuration={successPageDuration}
          />
        ),
      });
      return;
    }

    pushPage({
      key: `Connect ${provider.info.name}`,
      content: (
        <ActionPage
          title={`Connecting ${provider.info.name}`}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
          closeOnComplete={false}
          action={async () => {
            try {
              await connectWalletAccount(provider);
              onSuccess();
              if (successPageDuration && successPageDuration > 0) {
                pushPage({
                  key: "Connecting Success",
                  content: (
                    <SuccessPage
                      text="Successfully connected wallet!"
                      onComplete={() => closeModal()}
                      duration={successPageDuration}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            } catch (error) {
              onError(error);
            }
          }}
        />
      ),
      showTitle: false,
    });
  };

  const handleDisconnectWallet = async (provider: WalletProvider) => {
    pushPage({
      key: `Disconnect ${provider.info.name}`,
      content: (
        <DisconnectWalletScreen
          provider={provider}
          onDisconnect={async () => {
            try {
              await disconnectWalletAccount(provider);
              onSuccess();
              if (successPageDuration) {
                pushPage({
                  key: "Disconnect Success",
                  content: (
                    <SuccessPage
                      text="Successfully disconnected wallet!"
                      onComplete={() => closeModal()}
                      duration={successPageDuration}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            } catch (error) {
              onError(error);
            }
          }}
        />
      ),
      showTitle: false,
    });
  };
  return (
    <ExternalWalletSelector
      providers={providers}
      onSelect={handleConnectWallet}
      onDisconnect={handleDisconnectWallet}
    />
  );
}
