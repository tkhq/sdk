import clsx from "clsx";
import { useModal } from "../../providers/modal/Hook";
import { useEffect, useRef, useState } from "react";
import { Transition, TransitionChild } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useTurnkey } from "../../providers/client/Hook";
import type { HandleVerifyAppProofsParams } from "../../types/method-types";
import { Spinner } from "../design/Spinners";

type VerifyPageProps = HandleVerifyAppProofsParams & {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  successPageDuration?: number;
};

export function VerifyPage(props: VerifyPageProps) {
  const { onSuccess, onError, successPageDuration } = props;

  const { isMobile, closeModal } = useModal();
  const { verifyAppProofs } = useTurnkey();

  const hasRun = useRef(false);

  const [hasCompleted, setHasCompleted] = useState(false);
  const [isTextPinging, setIsTextPinging] = useState(false);

  // Run verification once
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const closeTimeoutRef = {
      current: undefined as ReturnType<typeof setTimeout> | undefined,
    };

    const runAction = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 300)); // slight delay to allow modal animation to complete. The verifyAppProofs call can sometimes freeze the UI while it runs
        await verifyAppProofs({ ...props });
        setHasCompleted(true);

        if (!successPageDuration || successPageDuration === 0) {
          onSuccess?.();
          closeModal();
          return;
        }

        setTimeout(() => setIsTextPinging(true), 500);
        setTimeout(() => setIsTextPinging(false), 1500);

        closeTimeoutRef.current = setTimeout(() => {
          onSuccess?.();
          closeModal();
        }, successPageDuration);
      } catch (err) {
        onError?.(err);
        closeModal();
      }
    };

    runAction();

    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-5 transition-all duration-300",
        isMobile ? "w-full" : "w-72",
      )}
    >
      {!hasCompleted && (
        <div className="size-full absolute text-center text-lg font-semibold flex flex-row items-center justify-center gap-2">
          <Spinner strokeWidth={2} className="h-full" />
          <span className="animate-pulse">Verifying...</span>
        </div>
      )}

      {/* Animation */}
      <div className="relative flex flex-col items-center justify-center size-[88px] overflow-hidden">
        <Transition
          as="div"
          show={hasCompleted}
          enter="transition-all duration-600 ease-in-out"
          enterFrom="opacity-0 scale-40"
          enterTo="opacity-100 scale-100"
          className=" absolute size-full flex flex-col items-center justify-center"
        >
          <div className="size-full border-2 border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark rounded-full flex flex-col items-center justify-center box-border">
            <TransitionChild
              as="div"
              enter="transition-all duration-200 delay-300 ease-out"
              enterFrom="opacity-0 scale-60"
              enterTo="opacity-100 scale-100"
              className="relative flex flex-col items-center justify-center"
            >
              <FontAwesomeIcon icon={faCheck} size="2x" />
              <FontAwesomeIcon
                className="absolute animate-ping"
                icon={faCheck}
                size="2x"
              />
            </TransitionChild>
          </div>
        </Transition>
      </div>

      {/* Success text */}
      <Transition
        as="div"
        show={hasCompleted}
        className="w-full text-center text-lg font-semibold flex flex-col items-center justify-center mt-2 relative"
        enter="transition-all ease-out duration-200 delay-200"
        enterFrom="opacity-0 -translate-y-2"
        enterTo="opacity-100 translate-y-0"
      >
        <span>Verified!</span>

        {isTextPinging && (
          <span className="absolute animate-ping text-icon-text-light dark:text-icon-text-dark">
            Verified!
          </span>
        )}
      </Transition>
    </div>
  );
}
