"use client";

import { Gem, LogOut } from "lucide-react";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Label } from "./ui/label";

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
  const truncatedAddress = `${address?.slice(0, 8)}•••${address?.slice(-6)}`;

  return (
    <div className="flex flex-col items-start gap-2">
      <Label className="text-sm">Account</Label>
      <div className="flex gap-1">
        <Card className="w-min cursor-pointer rounded-lg p-2 tracking-loose">
          {truncatedAddress}
        </Card>
        <Button variant="outline" onClick={() => disconnect()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
