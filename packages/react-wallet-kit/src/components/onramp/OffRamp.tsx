import clsx from "clsx";
import { useModal } from "../../providers/modal/Hook";
import { OffRampAmount, type OffRampAmountProps } from "./OffRampAmount";
import { OffRampPayoutList, type OffRampPayoutId } from "./PaymentMethods";

export function OffRampPage(props: OffRampAmountProps) {
  const { isMobile, pushPage } = useModal();

  const openAmount = (payout: OffRampPayoutId) =>
    pushPage({
      key: "Sell",
      showTitle: false,
      content: <OffRampAmount {...props} payout={payout} />,
    });

  return (
    <div
      className={clsx("flex flex-col pb-3 pt-9", isMobile ? "w-full" : "w-96")}
    >
      <OffRampPayoutList onSelect={openAmount} />
    </div>
  );
}
