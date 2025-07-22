import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Player } from "@lottiefiles/react-lottie-player";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useModal } from "../../providers";

interface SuccessPageProps {
  text?: string | undefined;
  duration?: number | undefined;
  onComplete: () => void;
}

export function SuccessPage(props: SuccessPageProps) {
  const { text = "Success", duration = 2000, onComplete } = props;
  const [pulsing, setPulsing] = useState(false);
  const { isMobile } = useModal();
  const [scale, setScale] = useState(0);

  useEffect(() => {
    setScale(1);
    const pulseTimer = setTimeout(() => {
      setPulsing(true);
    }, 300);
    const totalTimer = setTimeout(() => {
      onComplete();
    }, duration);
    return () => {
      clearTimeout(totalTimer);
      clearTimeout(pulseTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center",
        isMobile ? "w-full py-4" : "w-72 p-4",
      )}
    >
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
          className="flex absolute items-center justify-center rounded-full bg-green-500 dark:bg-green-500 transition-all duration-300"
        >
          <FontAwesomeIcon
            style={{ height: "50px", width: "50px" }}
            className="text-modal-background-light dark:text-modal-background-dark"
            icon={faCheck}
          />
          {pulsing && (
            <FontAwesomeIcon
              style={{ height: "50px", width: "50px" }}
              className="text-modal-background-light dark:text-modal-background-dark absolute animate-ping"
              icon={faCheck}
            />
          )}
        </div>

        {/*@ts-ignore. I have no idea how to fix this error */}
        <Player
          style={{ height: "300px", width: "300px" }}
          autoplay
          loop={false}
          src={
            "https://lottie.host/a7306a93-4125-48e1-b0e9-17904e5a774e/2aVGSPuWWf.json"
          }
        />
      </div>
      <p className="text-lg font-medium mt-2 text-center">{text}</p>
    </div>
  );
}
