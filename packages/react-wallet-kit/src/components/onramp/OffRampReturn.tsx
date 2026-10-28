import { useLayoutEffect, useRef, useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { OnRampProviders } from "./OnRamp";
import { OffRampDeposit } from "./OffRampDeposit";
import {
  OFFRAMP_ACK_MESSAGE,
  OFFRAMP_CHANNEL,
  OFFRAMP_DEPOSIT_MESSAGE,
  moonPayDeposit,
  newOffRampReturnId,
  publishOffRampReturn,
  readOffRampHandoff,
  readOffRampReturnAck,
  stripMoonPayReturnParams,
} from "./offRampRedirect";

// MoonPay sends redirectUrl to a new window and often drops window.opener.
// Tell the original sell screen, then close, so this page never becomes a
// second copy of the app. A full-page return still opens the deposit step.
export function OffRampReturn() {
  const { openModal } = useModal();
  const openModalRef = useRef(openModal);
  openModalRef.current = openModal;
  const [phase, setPhase] = useState<"idle" | "returning" | "close-tab">(
    "idle",
  );

  useLayoutEffect(() => {
    const deposit = moonPayDeposit(window.location.href);
    if (!deposit) return;

    let cancelled = false;
    let acked = false;
    let stripTimer = 0;
    let attempts = 0;
    const id = newOffRampReturnId();
    setPhase("returning");

    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(OFFRAMP_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; id?: string };
        if (data?.type === OFFRAMP_ACK_MESSAGE && data.id === id) acked = true;
      };
    } catch {
      // The ack key poll below covers browsers without BroadcastChannel.
    }

    publishOffRampReturn(id, deposit);

    const opener = window.opener as Window | null;
    if (opener && opener !== window && !opener.closed) {
      try {
        opener.postMessage(
          { type: OFFRAMP_DEPOSIT_MESSAGE, id, deposit },
          window.location.origin,
        );
      } catch {
        // The channel and storage write already reached the original window.
      }
    }

    let poll = 0;
    let giveUp = 0;

    const closeAfterAck = () => {
      if (cancelled || !acked) return false;
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      stripMoonPayReturnParams();
      window.close();
      window.setTimeout(() => {
        if (!cancelled && !window.closed) setPhase("close-tab");
      }, 200);
      return true;
    };

    poll = window.setInterval(() => {
      if (readOffRampReturnAck() === id) acked = true;
      closeAfterAck();
    }, 50);

    const openHere = () => {
      if (cancelled || acked) return;
      const handoff = readOffRampHandoff();
      if (!handoff) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(openHere, 50);
          return;
        }
        setPhase("idle");
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
      setPhase("idle");
      // Leave the address in the URL until this effect survives a remount.
      // Stripping it immediately makes the second pass find nothing to open.
      stripTimer = window.setTimeout(() => {
        if (!cancelled) stripMoonPayReturnParams();
      }, 0);
    };

    giveUp = window.setTimeout(() => {
      window.clearInterval(poll);
      if (cancelled || acked) return;
      openHere();
    }, 1500);

    if (acked) closeAfterAck();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      window.clearTimeout(stripTimer);
      channel?.close();
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      role="status"
      className="bg-modal-background-light text-center text-sm text-modal-background-dark dark:bg-modal-background-dark dark:text-modal-background-light"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
    >
      {phase === "close-tab"
        ? "You can close this tab. The deposit address is ready in the original window."
        : "Returning to your wallet…"}
    </div>
  );
}
