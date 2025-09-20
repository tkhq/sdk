import {
  ExternalWalletSelector,
  DisconnectWalletScreen,
  WalletConnectScreen,
} from "../auth/Wallet";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";
import {
  WalletSource,
  type ConnectedWallet,
  type WalletAccount,
  type WalletProvider,
} from "@turnkey/core";
import { isWalletConnect } from "../../utils/utils";

interface ConnectWalletModalProps {
  providers: WalletProvider[];
  successPageDuration?: number | undefined;
  onSuccess: (type: "connect" | "disconnect", account: WalletAccount) => void;
  onError: (error: any) => void;
}
export function ConnectWalletModal(props: ConnectWalletModalProps) {
  const { providers, successPageDuration, onSuccess, onError } = props;
  const { pushPage, closeModal } = useModal();
  const { wallets, connectWalletAccount, disconnectWalletAccount } =
    useTurnkey();

  const handleConnectWallet = async (provider: WalletProvider) => {
    if (isWalletConnect(provider)) {
      // for WalletConnect we route to a dedicated screen
      // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
      pushPage({
        key: "Connect WalletConnect",
        content: (
          <WalletConnectScreen
            provider={provider}
            onAction={async (provider: WalletProvider) => {
              const account = await connectWalletAccount(provider);
              onSuccess("connect", account);
            }}
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
              const account = await connectWalletAccount(provider);
              onSuccess("connect", account);
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
              const address = provider.connectedAddresses[0];

              // we narrow to only connected wallets
              // because we know the account must come from one of them
              const connectedWallets = wallets.filter(
                (w): w is ConnectedWallet =>
                  w.source === WalletSource.Connected,
              );

              // find the matching account
              const matchedAccount = connectedWallets
                .flatMap((w) => w.accounts)
                .find((a) => a.address === address);

              await disconnectWalletAccount(provider);

              onSuccess("disconnect", matchedAccount!);

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
