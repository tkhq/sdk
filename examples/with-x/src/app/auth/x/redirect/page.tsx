"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { useTurnkey } from "@turnkey/sdk-react";

export default function LoadingPage() {
  const { indexedDbClient } = useTurnkey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pubKey, setPubKey] = useState<string | null>(null);
  const indexedDbInitialized = useRef(false);

  const auth_code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    const refreshKey = async () => {
      if (indexedDbClient !== undefined && !indexedDbInitialized.current) {
        indexedDbInitialized.current = true;

        await indexedDbClient.resetKeyPair();
        const newKey = await indexedDbClient.getPublicKey();

        if (newKey) {
          setPubKey(newKey);
        }
      }
    };

    refreshKey();
  }, [indexedDbClient]);

  useEffect(() => {
    const turnkeyAuth = async () => {
      if (pubKey == undefined) return;

      try {
        const { data } = await axios.post("/auth/turnkey/x", {
          auth_code: auth_code,
          state: state,
          public_key: pubKey,
        });

        router.push("/dashboard");
      } catch (e) {
        console.error(`Failed logging in: ${e}`);
        router.push("/");
      }
    };
    turnkeyAuth();
  }, [pubKey]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-black"></div>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Logging In</h1>
        <p className="text-muted-foreground">
          Please wait while we sign you in...
        </p>
      </div>
    </main>
  );
}
