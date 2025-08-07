import { PhoneSVG } from "@/components/Svg";
import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export default function PhoneAuthButton() {
  const { user, handleAddPhoneNumber, handleRemoveUserPhoneNumber } =
    useTurnkey();

  return (
    <AuthToggleButton
      label="SMS"
      icon={<PhoneSVG className="w-6 h-6" />}
      isLinked={!!user?.userPhoneNumber}
      onAdd={handleAddPhoneNumber}
      onRemove={() => handleRemoveUserPhoneNumber({})}
    />
  );
}
