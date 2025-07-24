import { faPhone } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import { PhoneInputBox } from "../design/Inputs";
import clsx from "clsx";

export function UpdatePhoneNumber(params: {
  onContinue?: (phone: string, formattedPhone: string) => Promise<void>;
  title?: string;
  subTitle?: string;
}) {
  const { user } = useTurnkey();
  const { isMobile } = useModal();
  const phone = user?.userPhoneNumber || "";
  const [phoneInput, setPhoneInput] = useState(phone);
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");

  const handleContinue = async () => {
    if (isValid && params.onContinue) {
      setLoading(true);
      try {
        await Promise.resolve(params.onContinue(phoneInput, formattedPhone));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-72")}>
      <div className="my-6 flex flex-col items-center">
        <FontAwesomeIcon icon={faPhone} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          {params?.title ? params.title : "Update your phone number"}
        </div>
        {params?.subTitle && (
          <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            {params.subTitle}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 my-3">
        <PhoneInputBox
          value={phone}
          onChange={(raw, formatted, valid) => {
            setPhoneInput(raw);
            setFormattedPhone(formatted);
            setIsValid(valid);
          }}
          onEnter={handleContinue}
        />
        <ActionButton
          onClick={handleContinue}
          disabled={!isValid}
          loading={loading}
          className="w-full max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      </div>
    </div>
  );
}
