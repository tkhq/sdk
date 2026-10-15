import type { v1FiatOnRampPaymentMethod } from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { OnRampAmount, type OnRampAmountProps } from "./OnRampAmount";
import { PaymentMethodList } from "./PaymentMethods";

export function OnRampCash(props: OnRampAmountProps) {
  const { pushPage } = useModal();

  const openAmount = (method: v1FiatOnRampPaymentMethod) =>
    pushPage({
      key: "Buy",
      showTitle: false,
      content: <OnRampAmount {...props} paymentMethod={method} />,
    });

  return <PaymentMethodList onSelect={openAmount} />;
}
