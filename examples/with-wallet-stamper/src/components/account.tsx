"use client";

import { Gem, LogOut } from "lucide-react";

import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface AccountProps {
  address: string | null;
  balance: string;
  disconnect: () => void;
}

export default function Account({
  address,
  balance,
  disconnect,
}: AccountProps) {
  const truncatedAddress = `${address?.slice(0, 8)}...${address?.slice(-6)}`;

  return (
    <div className="flex items-center gap-4">
      <Card className="flex h-full items-center space-x-2 p-2">
        <Gem className="h-4 w-4" />
        <span className="text-center">{balance}</span>
      </Card>
      <Card className="w-min cursor-pointer rounded-lg p-2">
        {/* <LogOut className="mr-2 h-4 w-4" /> */}
        {truncatedAddress}
      </Card>
      <Button onClick={() => disconnect()}>
        <LogOut className="h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}
