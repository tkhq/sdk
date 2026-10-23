import type { v1FiatOnRampPaymentMethod } from "@turnkey/core";
import clsx from "clsx";
import { useModal } from "../../providers/modal/Hook";
import { OffRampAmount, type OffRampAmountProps } from "./OffRampAmount";
import { PaymentMethodList } from "./PaymentMethods";

export function OffRampPage(props: OffRampAmountProps) {
  const { isMobile, pushPage } = useModal();

  const openAmount = (method: v1FiatOnRampPaymentMethod) =>
    pushPage({
      key: "Sell",
      showTitle: false,
      content: <OffRampAmount {...props} paymentMethod={method} />,
    });

  return (
    <div
      className={clsx("flex flex-col pb-3 pt-9", isMobile ? "w-full" : "w-96")}
    >
      <PaymentMethodList onSelect={openAmount} />
    </div>
  );
}
