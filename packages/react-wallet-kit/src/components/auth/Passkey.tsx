import { ActionButton } from "../design/Buttons";

interface PasskeyButtonsProps {
  onLogin: () => void;
  onSignUp: () => void;
}

export function PasskeyButtons(props: PasskeyButtonsProps) {
  const { onLogin, onSignUp } = props;
  return (
    <div className="flex flex-col gap-4 w-full">
      <ActionButton
        onClick={onLogin}
        className="w-full text-inherit bg-button-light dark:bg-button-dark"
      >
        Log in with passkey
      </ActionButton>
      <ActionButton
        onClick={onSignUp}
        className="w-full bg-transparent text-primary-light dark:text-primary-dark border-none"
      >
        Sign up with passkey
      </ActionButton>
    </div>
  );
}
