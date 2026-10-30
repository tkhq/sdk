import {
  faBuildingColumns,
  faChevronRight,
  faCreditCard,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { faApple, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { v1FiatRampPaymentMethod } from "@turnkey/core";
import clsx from "clsx";
import { forwardRef, useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";

type PayoutOption = {
  id: string;
  label: string;
  description: string;
  icon: IconDefinition;
};

const paymentMethods: (PayoutOption & {
  method: v1FiatRampPaymentMethod;
})[] = [
  {
    id: "FIAT_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD",
    method: "FIAT_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD",
    label: "Card",
    description: "Directly enter your debit or credit card details",
    icon: faCreditCard,
  },
  {
    id: "FIAT_RAMP_PAYMENT_METHOD_APPLE_PAY",
    method: "FIAT_RAMP_PAYMENT_METHOD_APPLE_PAY",
    label: "Apple Pay",
    description: "Use your Apple Wallet to pay",
    icon: faApple,
  },
  {
    id: "FIAT_RAMP_PAYMENT_METHOD_GOOGLE_PAY",
    method: "FIAT_RAMP_PAYMENT_METHOD_GOOGLE_PAY",
    label: "Google Pay",
    description: "Use your Google Wallet to pay",
    icon: faGoogle,
  },
];

function PaymentMethodButton(props: {
  option: PayoutOption;
  onSelect: () => void;
}) {
  const { option, onSelect } = props;
  const { isMobile } = useModal();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <ActionButton
      name={`onramp-${option.id}`}
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
      <span className="flex flex-col items-start">
        <span>{option.label}</span>

        <span className="text-xs text-icon-text-light dark:text-icon-text-dark">
          {option.description}
        </span>
      </span>
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

export type PaymentMethodListProps = {
  onSelect: (method: v1FiatRampPaymentMethod) => void;
  className?: string;
};

export const PaymentMethodList = forwardRef<
  HTMLDivElement,
  PaymentMethodListProps
>(function PaymentMethodList(props, ref) {
  const { onSelect, className } = props;

  return (
    <div ref={ref} className={clsx("flex w-full flex-col gap-2", className)}>
      {paymentMethods.map((option) => (
        <PaymentMethodButton
          key={option.id}
          option={option}
          onSelect={() => onSelect(option.method)}
        />
      ))}
    </div>
  );
});

export function PaymentMethodSelect(props: {
  value?: v1FiatRampPaymentMethod | undefined;
  onChange: (method: v1FiatRampPaymentMethod) => void;
}) {
  const { value, onChange } = props;
  const { openSheet, closeSheet } = useModal();
  const option = paymentMethods.find((item) => item.id === value);
  if (!option) return null;

  return (
    <PaymentMethodButton
      option={option}
      onSelect={() =>
        openSheet({
          key: "Payment method",
          content: (
            <PaymentMethodList
              onSelect={(method) => {
                onChange(method);
                closeSheet();
              }}
            />
          ),
        })
      }
    />
  );
}

// Sell quotes use one enum value per provider. Card and ACH are shared.
// A fiat account is Coinbase's fiat wallet and MoonPay's balance.
export type OffRampPayoutId = "card" | "ach" | "fiat-account";

export const offRampPayouts: (PayoutOption & {
  id: OffRampPayoutId;
  methods: v1FiatRampPaymentMethod[];
})[] = [
  {
    id: "card",
    label: "Card",
    description: "Receive the sale on a debit card",
    icon: faCreditCard,
    methods: ["FIAT_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD"],
  },
  {
    id: "ach",
    label: "ACH transfer",
    description: "Receive the sale in a US bank account",
    icon: faBuildingColumns,
    methods: ["FIAT_RAMP_PAYMENT_METHOD_ACH_BANK_ACCOUNT"],
  },
  {
    id: "fiat-account",
    label: "Fiat account",
    description: "Receive the sale in a fiat balance",
    icon: faWallet,
    methods: [
      "FIAT_RAMP_PAYMENT_METHOD_FIAT_WALLET",
      "FIAT_RAMP_PAYMENT_METHOD_MOONPAY_BALANCE",
    ],
  },
];

export function offRampPayoutMethods(payout: OffRampPayoutId | undefined) {
  return offRampPayouts.find((item) => item.id === payout)?.methods;
}

export type OffRampPayoutListProps = {
  onSelect: (payout: OffRampPayoutId) => void;
  className?: string;
};

export const OffRampPayoutList = forwardRef<
  HTMLDivElement,
  OffRampPayoutListProps
>(function OffRampPayoutList(props, ref) {
  const { onSelect, className } = props;

  return (
    <div ref={ref} className={clsx("flex w-full flex-col gap-2", className)}>
      {offRampPayouts.map((option) => (
        <PaymentMethodButton
          key={option.id}
          option={option}
          onSelect={() => onSelect(option.id)}
        />
      ))}
    </div>
  );
});

export function OffRampPayoutSelect(props: {
  value?: OffRampPayoutId | undefined;
  onChange: (payout: OffRampPayoutId) => void;
}) {
  const { value, onChange } = props;
  const { openSheet, closeSheet } = useModal();
  const option = offRampPayouts.find((item) => item.id === value);
  if (!option) return null;

  return (
    <PaymentMethodButton
      option={option}
      onSelect={() =>
        openSheet({
          key: "Payout method",
          content: (
            <OffRampPayoutList
              onSelect={(payout) => {
                onChange(payout);
                closeSheet();
              }}
            />
          ),
        })
      }
    />
  );
}
