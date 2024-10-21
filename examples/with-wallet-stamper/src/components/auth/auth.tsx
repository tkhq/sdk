"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AuthOptions } from "./auth.options";
import { Tabs, TabsContent } from "../ui/tabs";
import { ConnectWallet } from "../connect-wallet";
import { useTurnkey } from "../turnkey-provider";
import { Email } from "@/lib/turnkey";

import { useTurnkey as useReactTurnkey } from "@turnkey/sdk-react";

export function AuthForm({ isSignUp = false }) {
  const [authOption, setAuthOption] = useState("wallet");
  const [email, setEmail] = useState("");
  const { walletClient, createSubOrg, authenticating, signInWithWallet } =
    useTurnkey();

  const { turnkey, authIframeClient } = useReactTurnkey();

  const handleSignUp = async () => {
    if (walletClient) {
      if (isSignUp) {
        await createSubOrg(email as Email);
      } else {
        await signInWithWallet(email as Email);
      }
    }
  };

  const handleEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  return (
    <Card className="">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {isSignUp ? "Sign Up" : "Sign In"}
        </CardTitle>
        <CardDescription>
          {isSignUp
            ? "Select your authentication method to get started!"
            : "Sign in to your account to continue."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-12">
        <AuthOptions
          value={authOption}
          onValueChange={(value) => setAuthOption(value)}
        />
        <Tabs
          defaultValue="wallet"
          value={authOption}
          onValueChange={(value: string) => setAuthOption(value)}
          className=""
        >
          <TabsContent value="wallet">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="satoshi@btc.xyz"
                onChange={handleEmail}
                // required
              />
            </div>
            <Card className="border-none bg-gray-900">
              <CardHeader className="gap-1">
                <CardTitle>Connect Wallet</CardTitle>
                <CardDescription>
                  {isSignUp
                    ? "Connect your wallet to get started!"
                    : "Connect your wallet to continue."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ConnectWallet />
                {walletClient && (
                  <Button variant="secondary" onClick={handleSignUp}>
                    {authenticating && (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {authenticating
                      ? "Authenticating..."
                      : isSignUp
                      ? "Sign Up"
                      : "Sign In"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="passkey">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="satoshi@btc.xyz"
                onChange={handleEmail}
                required
              />
            </div>
          </TabsContent>
          <TabsContent value="email">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="satoshi@btc.xyz"
                onChange={handleEmail}
                required
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
