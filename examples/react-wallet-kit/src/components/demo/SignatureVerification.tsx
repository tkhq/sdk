import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function SignatureVerification({
  verificationPassed,
  signature,
}: {
  verificationPassed: boolean;
  signature: string | null;
}) {
  const [scale, setScale] = useState(0);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    setScale(1);
    const pulseTimer = setTimeout(() => {
      setPulsing(true);
    }, 300);
    return () => {
      clearTimeout(pulseTimer);
    };
  }, []);

  return (
    <div className="flex flex-col justify-center w-72 p-4">
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: "150px", width: "150px" }}
      >
        <div
          style={{
            height: "100px",
            width: "100px",
            transform: `scale(${scale})`,
          }}
          className={`flex absolute left-1/2 -translate-x-1/2 items-center justify-center rounded-full transition-all duration-300 ${verificationPassed ? "bg-success-light dark:bg-success-dark" : "bg-danger-light dark:bg-danger-dark"}`}
        >
          <FontAwesomeIcon
            style={{ height: "50px", width: "50px" }}
            className="text-modal-background-light dark:text-modal-background-dark"
            icon={verificationPassed ? faCheck : faXmark}
          />
          {pulsing && verificationPassed && (
            <FontAwesomeIcon
              style={{ height: "50px", width: "50px" }}
              className="text-modal-background-light dark:text-modal-background-dark absolute animate-ping"
              icon={verificationPassed ? faCheck : faXmark}
            />
          )}
        </div>
      </div>
      <div>
        <p className="text-lg font-medium mt-2 text-center">
          {verificationPassed
            ? "Signature Verified"
            : "Signature Verification Failed"}
        </p>
        {verificationPassed && (
          <p className="text-xs text-icon-text-light dark:text-icon-text-dark text-center">
            The address used to sign the message matches your wallet address.
          </p>
        )}

        {signature && (
          <p className="border wrap-break-word bg-icon-background-light dark:bg-icon-background-dark font-mono text-icon-text-light dark:text-icon-text-dark border-background-light dark:border-background-dark p-2 rounded-lg mt-2 text-sm">
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}
