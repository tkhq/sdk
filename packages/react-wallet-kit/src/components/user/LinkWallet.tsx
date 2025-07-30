import { ExternalWalletSelector, UnlinkWalletScreen } from "../auth/Wallet";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";
import type { WalletProvider } from "@turnkey/sdk-js";

interface LinkWalletModalProps {
  providers: WalletProvider[];
  successPageDuration?: number | undefined;
}
export function LinkWalletModal(props: LinkWalletModalProps) {
  const { providers, successPageDuration } = props;
  const { pushPage, closeModal } = useModal();
  const { connectWalletAccount, disconnectWalletAccount } = useTurnkey();

  const hanldeLinkWallet = (provider: WalletProvider) => {
    pushPage({
      key: `Link ${provider.info.name}`,
      content: (
        <ActionPage
          title={`Linking ${provider.info.name}`}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
          closeOnComplete={false}
          action={async () => {
            await connectWalletAccount(provider);
            if (successPageDuration && successPageDuration > 0) {
              pushPage({
                key: "Link Success",
                content: (
                  <SuccessPage
                    text="Successfully linked wallet!"
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
          }}
        />
      ),
      showTitle: false,
    });
  };

  const handleUnlinkWallet = (provider: WalletProvider) => {
    pushPage({
      key: `Unlink ${provider.info.name}`,
      content: (
        <UnlinkWalletScreen
          provider={provider}
          onUnlink={async () => {
            await disconnectWalletAccount(provider);
            if (successPageDuration) {
              pushPage({
                key: "Unlink Success",
                content: (
                  <SuccessPage
                    text="Successfully unlinked wallet!"
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
          }}
        />
      ),
      showTitle: false,
    });
  };
  return (
    <ExternalWalletSelector
      providers={providers}
      onSelect={hanldeLinkWallet}
      onUnlink={handleUnlinkWallet}
    />
  );
}
