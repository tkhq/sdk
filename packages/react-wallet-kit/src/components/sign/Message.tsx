import { Textarea } from "@headlessui/react";
import { StamperType } from "@turnkey/sdk-js";
import { v1SignRawPayloadResult, v1WalletAccount } from "@turnkey/sdk-types";
import { ActionButton } from "../design/Buttons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { useRef, useEffect, useState } from "react";
import { useModal, useTurnkey } from "../../providers";
import { SuccessPage } from "../design/Success";

interface SignMessageModalProps {
  message: string;
  wallet: v1WalletAccount;
  subText?: string | undefined;
  stampWith?: StamperType | undefined;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  onSuccess: (result: v1SignRawPayloadResult) => void;
  onError: (error: any) => void;
}

export function SignMessageModal(props: SignMessageModalProps) {
  const {
    message,
    wallet,
    subText = "Use your wallet to sign this message",
    stampWith,
    successPageDuration,
    onSuccess,
    onError,
  } = props;

  const { signMessage } = useTurnkey();
  const { pushPage, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // reset height
      textarea.style.height = `${Math.min(textarea.scrollHeight, 288)}px`; // max-h-72 = 288px
    }
  }, [message]);

  const handleSign = async () => {
    try {
      setLoading(true);
      const result = await signMessage({
        message,
        wallet,
        ...(stampWith ? { stampWith } : {}),
        modalOptions: { enabled: false }, // Disable modal for direct signing
      });
      handleSuccess(result);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (result: v1SignRawPayloadResult) => {
    onSuccess(result); // Run the success callback first before showing the success page.

    if (successPageDuration && successPageDuration === 0) return;

    pushPage({
      key: "success",
      content: (
        <SuccessPage
          text="Message Signed Successfully!"
          duration={successPageDuration}
          onComplete={() => {
            closeModal();
          }}
        />
      ),
      preventBack: true,
      showTitle: false,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center w-80 p-4">
      <p className="mt-3 text-sm text-icon-text-light/70 dark:text-icon-text-dark/70">
        {subText}
      </p>
      <div className="w-full flex flex-row items-center mt-1 gap-1.5 text-sm text-icon-text-light/70 dark:text-icon-text-dark/70">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark">
          <FontAwesomeIcon icon={faWallet} />
        </div>

        {wallet.address.length > 8
          ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
          : wallet.address}
      </div>

      <div className="w-full flex flex-col mt-2 px-3 space-y-2">
        <Textarea
          ref={textareaRef}
          className="p-2 min-h-12 max-h-72 rounded-md tk-scrollbar border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark focus:outline-none resize-none overflow-y-auto"
          value={message}
          readOnly
        />
      </div>
      <ActionButton
        onClick={handleSign}
        spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        loading={loading}
        className="mt-4 bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
      >
        Sign
      </ActionButton>
    </div>
  );
}
