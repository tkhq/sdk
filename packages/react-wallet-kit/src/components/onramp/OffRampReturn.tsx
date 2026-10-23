import { useEffect, useRef } from "react";
import { useModal } from "../../providers/modal/Hook";
import { OnRampProviders } from "./OnRamp";
import { OffRampDeposit } from "./OffRampDeposit";
import {
  OFFRAMP_DEPOSIT_MESSAGE,
  moonPayDeposit,
  readOffRampHandoff,
  stripMoonPayReturnParams,
  type MoonPayDeposit,
} from "./offRampRedirect";

// MoonPay sends the browser to redirectUrl. That load replaces the page the
// modal was on, so this window has to open the deposit screen itself.
export function OffRampReturn() {
  const { openModal } = useModal();
  const openModalRef = useRef(openModal);
  openModalRef.current = openModal;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let stripTimer = 0;

    const notifyOpener = (deposit: MoonPayDeposit) => {
      const opener = window.opener as Window | null;
      if (!opener || opener === window || opener.closed) return;
      opener.postMessage(
        { type: OFFRAMP_DEPOSIT_MESSAGE, deposit },
        window.location.origin,
      );
    };

    const open = () => {
      if (cancelled) return;
      const deposit = moonPayDeposit(window.location.href);
      if (!deposit) return;
      notifyOpener(deposit);

      const handoff = readOffRampHandoff();
      if (!handoff) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(open, 50);
        }
        return;
      }

      openModalRef.current({
        key: "Sell",
        showTitle: false,
        preventBack: true,
        contextProvider: OnRampProviders,
        content: (
          <OffRampDeposit
            token={handoff.token}
            amount={handoff.amount}
            atomicAmount={handoff.atomicAmount}
            walletAccount={handoff.walletAccount}
            provider={handoff.provider}
            organizationId={handoff.organizationId}
            stampWith={handoff.stampWith}
            rpcUrl={handoff.rpcUrl}
            sandboxMode={handoff.sandboxMode}
            successPageDuration={handoff.successPageDuration}
            initialAddress={deposit.address}
            initialAmount={deposit.amount}
            initialTag={deposit.tag}
          />
        ),
      });

      // Leave the address in the URL until this effect survives a remount.
      // Stripping it immediately makes the second pass find nothing to open.
      stripTimer = window.setTimeout(() => {
        if (!cancelled) stripMoonPayReturnParams();
      }, 0);
    };

    open();
    return () => {
      cancelled = true;
      window.clearTimeout(stripTimer);
    };
  }, []);

  return null;
}
