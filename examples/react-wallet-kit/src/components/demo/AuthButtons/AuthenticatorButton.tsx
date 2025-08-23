import { KeySVG } from "@/components/Svg";
import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { toast } from "react-toastify";

export default function AuthenticatorButton({
  canRemoveAuthMethod,
}: {
  canRemoveAuthMethod: boolean;
}) {
  const { user, handleAddPasskey, handleRemovePasskey } = useTurnkey();
  const authenticator = user?.authenticators?.[0];

  const notify = () =>
    toast.error("Error: Cannot remove your last authenticator.");

  return (
    <AuthToggleButton
      label="Passkey"
      icon={<KeySVG className="w-6 h-6" />}
      isLinked={!!authenticator}
      onAdd={handleAddPasskey}
      canRemoveAuthMethod={canRemoveAuthMethod}
      onRemove={() => {
        handleRemovePasskey({
          authenticatorId: authenticator?.authenticatorId!,
        });
      }}
    />
  );
}
