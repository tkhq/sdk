import { faCoins, faMoneyBills } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useModal } from "../../providers/modal/Hook";
import { SupportedAssetsProvider } from "../../providers/SupportedAssetsProvider";
import { WalletConnectProvider } from "../../providers/WalletConnectProvider";
import { TabNav } from "../design/TabNav";
import { OnRampCash } from "./OnRampCash";
import { OnRampCrypto } from "./OnRampCrypto";
import type { OnRampAmountProps } from "./OnRampAmount";

export function OnRampProviders({ children }: { children: ReactNode }) {
  return (
    <SupportedAssetsProvider>
      <WalletConnectProvider>{children}</WalletConnectProvider>
    </SupportedAssetsProvider>
  );
}

export function OnRampPage(props: OnRampAmountProps) {
  const { isMobile } = useModal();

  return (
    <div
      className={clsx("flex flex-col pb-3 pt-9", isMobile ? "w-full" : "w-96")}
    >
      <TabNav
        defaultTab="cash"
        tabs={[
          {
            id: "crypto",
            label: "Use crypto",
            icon: <FontAwesomeIcon icon={faCoins} className="size-3.5" />,
            content: (
              <OnRampCrypto
                walletAccount={props.walletAccount}
                lockedCaip19={props.lockedCaip19}
                lockedCaip2={props.lockedCaip2}
                rpcUrl={props.rpcUrl}
                successPageDuration={props.successPageDuration}
                onSuccess={props.onSuccess}
                onError={props.onError}
              />
            ),
          },
          {
            id: "cash",
            label: "Use cash",
            icon: <FontAwesomeIcon icon={faMoneyBills} className="size-3.5" />,
            content: <OnRampCash {...props} />,
          },
        ]}
      />
    </div>
  );
}
