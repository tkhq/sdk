"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation";

export default function LoadingPage() {
  const searchParams = useSearchParams();
  const auth_code = searchParams.get("code"); 
  const state = searchParams.get("state");

  console.log(auth_code)
  console.log(state)

  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard")
    }, 1000)

    return () => clearTimeout(timer)
  }, [router])


  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-black"></div>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Logging In</h1>
        <p className="text-muted-foreground">Please wait while we sign you in...</p>
      </div>
    </main>
  )
}
