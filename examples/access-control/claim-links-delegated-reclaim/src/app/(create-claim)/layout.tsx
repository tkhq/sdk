import { Providers } from "@/app/providers";

export default function CreateClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
