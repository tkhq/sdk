import { faCoins, faMoneyBills } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useModal } from "../../providers/modal/Hook";
import { TabNav } from "../design/TabNav";
import { OnRampCash } from "./OnRampCash";
import { OnRampCrypto } from "./OnRampCrypto";
import type { OnRampAmountProps } from "./OnRampAmount";

export function OnRampPage(props: OnRampAmountProps) {
  const { isMobile } = useModal();

  return (
    <div
      className={clsx("flex flex-col pb-3 pt-9", isMobile ? "w-full" : "w-80")}
    >
      <TabNav
        defaultTab="cash"
        tabs={[
          {
            id: "crypto",
            label: "Use crypto",
            icon: <FontAwesomeIcon icon={faCoins} className="size-3.5" />,
            content: <OnRampCrypto />,
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
