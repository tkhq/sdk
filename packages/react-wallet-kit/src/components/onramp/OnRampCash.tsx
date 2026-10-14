import { faChevronRight, faCreditCard } from "@fortawesome/free-solid-svg-icons";
import { faApple, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { v1FiatOnRampPaymentMethod } from "@turnkey/core";
import clsx from "clsx";
import { useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";
import { OnRampAmount, type OnRampAmountProps } from "./OnRampAmount";

const paymentMethods: {
  method: v1FiatOnRampPaymentMethod;
  label: string;
  icon: IconDefinition;
}[] = [
  {
    method: "FIAT_ON_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD",
    label: "Card",
    icon: faCreditCard,
  },
  {
    method: "FIAT_ON_RAMP_PAYMENT_METHOD_APPLE_PAY",
    label: "Apple Pay",
    icon: faApple,
  },
  {
    method: "FIAT_ON_RAMP_PAYMENT_METHOD_GOOGLE_PAY",
    label: "Google Pay",
    icon: faGoogle,
  },
];

function PaymentMethodButton(props: {
  option: (typeof paymentMethods)[number];
  onSelect: () => void;
}) {
  const { option, onSelect } = props;
  const { isMobile } = useModal();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <ActionButton
      name={`onramp-${option.method}`}
      onClick={onSelect}
      {...(!isMobile && {
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      })}
      className="relative flex w-full items-center gap-2 overflow-hidden bg-button-light text-inherit dark:bg-button-dark"
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <FontAwesomeIcon icon={option.icon} className="size-4 text-xl" />
      </span>
      <span>{option.label}</span>
      <FontAwesomeIcon
        className={clsx(
          "absolute transition-all duration-200 text-icon-text-light dark:text-icon-text-dark",
          isHovering ? "right-4" : "-right-4",
        )}
        icon={faChevronRight}
      />
    </ActionButton>
  );
}

export function OnRampCash(props: OnRampAmountProps) {
  const { pushPage } = useModal();

  return (
    <div className="flex w-full flex-col gap-2">
      {paymentMethods.map((option) => (
        <PaymentMethodButton
          key={option.method}
          option={option}
          onSelect={() =>
            pushPage({
              key: "Buy",
              showTitle: false,
              content: (
                <OnRampAmount {...props} paymentMethod={option.method} />
              ),
            })
          }
        />
      ))}
    </div>
  );
}
