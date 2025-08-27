"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function Home() {
  const router = useRouter()

  const handleXLogin = () => {
    router.push("/auth/x")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <Image src="/turnkey.png" alt="Turnkey Logo" width={80} height={80} className="rounded-full" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">Welcome</h1>
        <p className="text-muted-foreground text-lg">Sign in to get started</p>
        <Button
          onClick={handleXLogin}
        >
          Login with
          <Image src="/x.svg" width={20} height={20} alt="Logo" />
          {/* <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg> */}
        </Button>
      </div>
    </main>
  )
}