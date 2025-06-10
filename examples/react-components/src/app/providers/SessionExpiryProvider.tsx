"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTurnkey } from "@turnkey/sdk-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import "./SessionExpiryProvider.css";
import LogoutIcon from "@mui/icons-material/Logout";
import { Typography } from "@mui/material";

type SessionExpiryCtx = {
  scheduleExpiry: (expiryEpochSec: number) => void;
};

const Ctx = createContext<SessionExpiryCtx | null>(null);

export const useSessionExpiry = () => {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useSessionExpiry must be inside SessionExpiryProvider");
  return ctx;
};

type Props = {
  children: ReactNode;
  warningBeforeSec?: number;
};

export const SessionExpiryProvider = ({
  children,
  warningBeforeSec = 60,
}: Props) => {
  const { turnkey, indexedDbClient } = useTurnkey();
  const router = useRouter();

  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(0);

  const warnTimer = useRef<NodeJS.Timeout>();
  const expireTimer = useRef<NodeJS.Timeout>();
  const countdownInterval = useRef<NodeJS.Timeout>();
  const mounted = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(expireTimer.current);
    clearInterval(countdownInterval.current);
  }, []);

  const logoutNow = useCallback(async () => {
    clearTimers();
    if (mounted.current) setShow(false);
    try {
      await turnkey?.logout();
    } catch (e) {
      console.error("logout error:", e);
    }
    router.replace("/");
  }, [turnkey, router, clearTimers]);

  const startCountdown = useCallback(
    (secondsLeft: number) => {
      setShow(true);
      setLeft(Math.floor(secondsLeft));
      countdownInterval.current = setInterval(() => {
        setLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            logoutNow();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [logoutNow],
  );

  const scheduleExpiry = useCallback(
    (expiry: number) => {
      if (!expiry) return;
      clearTimers();

      const now = Date.now() / 1000;
      const diff = expiry - now;

      if (diff <= 0) {
        logoutNow();
        return;
      }

      if (diff <= warningBeforeSec) {
        startCountdown(diff);
        expireTimer.current = setTimeout(logoutNow, diff * 1000);
      } else {
        warnTimer.current = setTimeout(
          () => {
            if (!mounted.current) return;
            startCountdown(warningBeforeSec);
          },
          (diff - warningBeforeSec) * 1000,
        );

        expireTimer.current = setTimeout(logoutNow, diff * 1000);
      }
    },
    [warningBeforeSec, logoutNow, clearTimers, startCountdown],
  );

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const session = await turnkey?.getSession();
        if (session?.expiry) scheduleExpiry(session.expiry);
      } catch (e) {
        console.error("Error checking session:", e);
      }
    };

    checkExistingSession();
  }, [turnkey, scheduleExpiry]);

  const extendNow = useCallback(async () => {
    if (!indexedDbClient) {
      toast.error("Session error", {
        description: "Please refresh the page.",
      });
      return;
    }

    try {
      await indexedDbClient.refreshSession({ expirationSeconds: "600" });
      const cur = await turnkey?.getSession();
      if (cur?.expiry) {
        const now = Date.now() / 1000;
        const diff = cur.expiry - now;

        scheduleExpiry(cur.expiry);

        if (diff <= warningBeforeSec) {
          startCountdown(diff);
        } else {
          setShow(false);
        }
      }
    } catch (e) {
      console.error("refreshSession error:", e);
    }
  }, [
    indexedDbClient,
    turnkey,
    scheduleExpiry,
    warningBeforeSec,
    startCountdown,
  ]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Ctx.Provider value={{ scheduleExpiry }}>
      {children}
      {show &&
        createPortal(
          <div className="sessionExpiryOverlay">
            <div className="sessionExpiryModal">
              <div>
                <h2 className="modalTitle">Session Expiring Soon</h2>
                <p className="modalMessage">
                  Your session will expire in{" "}
                  <span className="sessionExpiryTime">{mmss(left)}</span>. Click{" "}
                  <strong>Continue</strong> to extend your session by 10
                  minutes, or logout now.
                </p>
              </div>
              <div className="modalActions">
                <button onClick={logoutNow} className="secondaryButton">
                  <LogoutIcon />
                  <Typography>Logout</Typography>
                </button>
                <button onClick={extendNow}>
                  <Typography>Continue</Typography>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
};
