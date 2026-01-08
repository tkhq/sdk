import { ActionButton } from "../../design/Buttons";
import { useState } from "react";

interface WalletAuthButtonProps {
  onContinue: () => Promise<void>;
}
export function WalletAuthButton(props: WalletAuthButtonProps) {
  const { onContinue } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      await Promise.resolve(onContinue());
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col w-full">
      <ActionButton
        name="wallet-auth-button"
        onClick={handleContinue}
        loading={isLoading}
        className="w-full text-inherit bg-button-light dark:bg-button-dark"
      >
        Continue with wallet
      </ActionButton>
    </div>
  );
}
