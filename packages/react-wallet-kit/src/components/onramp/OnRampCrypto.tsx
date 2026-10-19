import { faChevronRight, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useState } from "react";
import type { OnRampCaip19, OnRampCaip2, WalletAccount } from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";
import { OnRampExternalWallet } from "./OnRampExternalWallet";

export function OnRampCrypto(props: {
  walletAccount?: WalletAccount | undefined;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
}) {
  const { walletAccount, lockedCaip19, lockedCaip2 } = props;
  const { pushPage, isMobile } = useModal();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <ActionButton
        name="onramp-external-wallet"
        onClick={() =>
          pushPage({
            key: "Select wallet provider",
            content: (
              <OnRampExternalWallet
                walletAccount={walletAccount}
                lockedCaip19={lockedCaip19}
                lockedCaip2={lockedCaip2}
              />
            ),
          })
        }
        {...(!isMobile && {
          onMouseEnter: () => setIsHovering(true),
          onMouseLeave: () => setIsHovering(false),
        })}
        className="relative flex w-full items-center gap-2 overflow-hidden bg-button-light text-inherit dark:bg-button-dark"
      >
        <span className="flex size-6 shrink-0 items-center justify-center">
          <FontAwesomeIcon icon={faWallet} className="size-4" />
        </span>
        <span>External wallet</span>
        <FontAwesomeIcon
          className={clsx(
            "absolute transition-all duration-200 text-icon-text-light dark:text-icon-text-dark",
            isHovering ? "right-4" : "-right-4",
          )}
          icon={faChevronRight}
        />
      </ActionButton>
    </div>
  );
}
