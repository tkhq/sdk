import React, { useEffect } from "react";
import Image from "next/image";
import styles from "../pages/index.module.css";

type ModalProps = {
  show: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal(props: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    if (props.show) {
      window.addEventListener("keydown", handleEscape);
    }

    // Cleanup the event listener
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [props]);

  if (!props.show) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.customModal}>
        <button
          type="button"
          onClick={props.onClose}
          className={styles.closeButton}
        >
          <span className={styles.srOnly}>Close menu</span>
          <Image
            className={`inline-block`}
            src="/close.svg"
            alt="Close"
            width={20}
            height={20}
            priority
          />
        </button>
        {props.children}
      </div>
    </div>
  );
}
