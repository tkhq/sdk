import clsx from "clsx";
import { VerifyBorderSVG, VerifyInnerSVG } from "./Svg";
import { useModal } from "../../providers/modal/Hook";
import { useEffect, useRef, useState } from "react";
import { Transition, TransitionChild } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

interface VerifyPageProps {
  action: () => Promise<void>;
}

export function VerifyPage(props: VerifyPageProps) {
  const { action } = props;
  const { isMobile } = useModal();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTextPinging, setIsTextPinging] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  const handleComplete = () => {
    setIsCompleted(true);
    setTimeout(() => {
      setIsTextPinging(true);
    }, 500);
    setTimeout(() => {
      setIsTextPinging(false);
    }, 1500);
    setTimeout(() => {
      setShowWallets(true);
    }, 1700);
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-5 transition-all duration-300",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <VerifyAnimation action={action} onComplete={handleComplete} />
      <Transition
        as="div"
        show={isCompleted}
        className="w-full text-center text-lg font-semibold flex flex-col items-center justify-center mt-2 relative"
        enter="transition-all ease-out duration-200 delay-200"
        enterFrom="opacity-0 -translate-y-2"
        enterTo="opacity-100 translate-y-0"
      >
        <span>Verified by Turnkey!</span>
        {isTextPinging && (
          <span className="absolute animate-ping text-icon-text-light dark:text-icon-background-dark">
            Verified by Turnkey!
          </span>
        )}
      </Transition>

      <Transition
        as="div"
        show={showWallets}
        className="w-full flex flex-col items-center justify-center mt-2 relative"
        enter="transition-all ease-out duration-250 delay-100 "
        enterFrom="opacity-0 -translate-y-4"
        enterTo="opacity-100 translate-y-0"
      >
        <span className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          Your wallet was created and{" "}
          {/* TODO (Amir): link to prod page when ready */}
          <a
            className="underline cursor-pointer"
            target="_blank"
            rel="noreferrer"
            href="https://turnkey-0e7c1f5b-rno-verified.mintlify.app/security/turnkey-verified"
          >
            verified by Turnkey's Secure Enclaves!
          </a>
        </span>

        <span className="text-icon-text-light dark:text-icon-text-dark text-xs w-full items-start text-start mt-5">
          Addresses:
        </span>
        <div className="w-full h-full overflow-y-scroll tk-scrollbar flex flex-col max-h-56 rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark text-sm font-mono!">
          <div className="gap-2 flex flex-col p-3">
            <div className="font-mono!">
              {"0xcc30cb0a3c72759755d81927c4df97804a3af5fb".slice(0, 10)}...
              {"0xCC30cb0A3C72759755D81927C4dF97804A3AF5fB".slice(-10)}
            </div>
            <div className="font-mono!">
              {"AH6eMzHupvDWseNF6DMVLjum9jeeaUMMxnirojHqLEyR".slice(0, 10)}...
              {"AH6eMzHupvDWseNF6DMVLjum9jeeaUMMxnirojHqLEyR".slice(-10)}
            </div>
          </div>
        </div>
      </Transition>
    </div>
  );
}

interface VerifyAnimationProps {
  action: () => Promise<void>;
  onComplete?: () => void;
}

export function VerifyAnimation(props: VerifyAnimationProps) {
  const { action } = props;
  const { closeModal } = useModal();
  const hasRun = useRef(false);

  const [hasCompleted, setHasCompleted] = useState(false);

  const handleComplete = () => {
    setHasCompleted(true);
    if (props.onComplete) {
      props.onComplete();
    }
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const runAction = async () => {
      if (action) {
        try {
          await action();
          handleComplete();
        } catch (error) {
          closeModal();
          throw new Error(`${error}`);
        }
      }
    };
    runAction();
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center size-[88px] overflow-hidden transition-all duration-300">
      <Transition
        as="div"
        show={!hasCompleted}
        appear={true}
        enter="transition-opacity duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-all duration-150 ease-out"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-80"
        className="flex items-center justify-center"
      >
        <VerifyInnerSVG className="absolute" />
        <div className="absolute size-full animate-scan flex items-center justify-center">
          <div className="size-full bg-gradient-to-b from-primary-light/0 to-primary-light/80 dark:from-primary-dark/0 dark:to-primary-dark/100 rounded" />
          <div className="w-full h-1 bg-primary-light dark:bg-primary-dark absolute bottom-0 rounded" />
        </div>

        {/* Corner borders. This is kinda a hacky fix to cover the corners of the border SVG */}
        <div className="absolute inset-0 pointer-events-none z-40">
          {/* Top-left */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-modal-background-light dark:border-modal-background-dark" />
          {/* Top-right */}
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-modal-background-light dark:border-modal-background-dark" />
          {/* Bottom-left */}
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-modal-background-light dark:border-modal-background-dark" />
          {/* Bottom-right */}
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-modal-background-light dark:border-modal-background-dark" />
        </div>

        <VerifyBorderSVG className="text-primary-light dark:text-primary-dark z-50" />
      </Transition>

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
  );
}
