import React from "react";
import dynamic from "next/dynamic";

const MoonPayProvider = dynamic(
  () => import("@moonpay/moonpay-react").then((mod) => mod.MoonPayProvider),
  { ssr: false },
);

interface MoonPayCryptoProviderProps {
  children: React.ReactNode;
}

const MoonPayCryptoProvider = ({ children }: MoonPayCryptoProviderProps) => {
  return (
    <MoonPayProvider
      apiKey={process.env.NEXT_PUBLIC_MOONPAY_API_KEY!}
      debug={true}
    >
      {children}
    </MoonPayProvider>
  );
};

export default MoonPayCryptoProvider;
