import { EmailSVG } from "@/components/Svg";
import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export default function EmailAuthButton() {
  const { user, handleAddEmail, handleRemoveUserEmail } = useTurnkey();

  return (
    <AuthToggleButton
      label="E-mail"
      icon={<EmailSVG className="w-6 h-6" />}
      isLinked={!!user?.userEmail}
      onAdd={handleAddEmail}
      onRemove={handleRemoveUserEmail}
    />
  );
}
