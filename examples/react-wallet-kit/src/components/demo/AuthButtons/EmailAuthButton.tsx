import { EmailSVG } from "@/components/Svg";
import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export default function EmailAuthButton({
  canRemoveAuthMethod,
}: {
  canRemoveAuthMethod: boolean;
}) {
  const { user, handleAddEmail, handleRemoveUserEmail } = useTurnkey();

  return (
    <AuthToggleButton
      label="Email"
      icon={<EmailSVG className="w-6 h-6" />}
      isLinked={!!user?.userEmail}
      onAdd={handleAddEmail}
      canRemoveAuthMethod={canRemoveAuthMethod}
      onRemove={() => {
        handleRemoveUserEmail();
      }}
    />
  );
}
