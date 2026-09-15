import Image from "next/image";
import { LoginWithXButton } from "@/components/LoginWithXButton";

export default async function ClaimPage({ params }: { params: Promise<{ subOrgId: string }> }) {
  const { subOrgId } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="flex justify-center"><Image src="/turnkey.png" alt="Turnkey" width={80} height={80} className="rounded-full" /></div>
        <h1 className="text-4xl font-bold">Claim your wallet</h1>
        <p className="text-muted-foreground">Sign in with the X account assigned to this allocation.</p>
        <LoginWithXButton subOrgId={subOrgId} />
      </div>
    </main>
  );
}
