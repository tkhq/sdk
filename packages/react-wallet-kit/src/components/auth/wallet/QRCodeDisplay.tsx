import { Spinner } from "../../design/Spinners";
import clsx from "clsx";
import { QRCodeSVG as QRCode } from "qrcode.react";

interface QRCodeDisplayProps {
  uri: string;
  icon: string;
  isLoading?: boolean;
}

export function QRCodeDisplay(props: QRCodeDisplayProps) {
  const { uri, icon, isLoading } = props;

  return (
    <div className="relative inline-block">
      {/* @ts-expect-error: qrcode.react uses a different React type version */}
      <QRCode
        className={clsx(
          "block border border-modal-background-dark/20 dark:border-modal-background-light/20",
          "shadow-[0_0_42px] shadow-primary-light/50 dark:shadow-[0_0_42px] dark:shadow-primary-dark/50",
          isLoading && "blur-sm",
        )}
        value={uri}
        imageSettings={{
          src: icon,
          width: 24,
          height: 24,
          excavate: true,
        }}
        size={200}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-12" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
