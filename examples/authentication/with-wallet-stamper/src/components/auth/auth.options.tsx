import { RadioGroup } from "../ui/radio-group";
import { AuthOption } from "./auth.option";
import { WalletMinimal, Key, Wand } from "lucide-react";

const authOptions = [
  { value: "wallet", id: "wallet", label: "Wallet", Icon: WalletMinimal },
  { value: "passkey", id: "passkey", label: "Passkey", Icon: Key },
  { value: "email", id: "email", label: "Magic Link", Icon: Wand },
];

interface AuthOptionsProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function AuthOptions({ value, onValueChange }: AuthOptionsProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onValueChange}
      className="grid grid-cols-3 gap-4 mx-auto"
    >
      {authOptions.map((option) => (
        <AuthOption
          key={option.id}
          value={option.value}
          id={option.id}
          label={option.label}
          Icon={option.Icon}
        />
      ))}
    </RadioGroup>
  );
}
