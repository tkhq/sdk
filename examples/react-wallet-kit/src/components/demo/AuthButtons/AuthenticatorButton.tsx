import { KeySVG } from "@/components/Svg";
import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export default function AuthenticatorButton() {
  const { user, handleAddPasskey, handleRemovePasskey } = useTurnkey();
  const authenticator = user?.authenticators?.[0];

  return (
    <AuthToggleButton
      label="Passkey"
      icon={<KeySVG className="w-6 h-6" />}
      isLinked={!!authenticator}
      onAdd={handleAddPasskey}
      onRemove={() =>
        handleRemovePasskey({
          authenticatorId: authenticator?.authenticatorId!,
        })
      }
    />
  );
}
