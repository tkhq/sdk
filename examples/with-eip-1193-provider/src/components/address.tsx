"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Icons } from "./ui/icons";
import { truncate } from "@/lib/utils";

interface AddressProps {
  address: string;
  prefixLength?: number;
  suffixLength?: number;
  canCopy?: boolean;
}

const Address: React.FC<AddressProps> = ({
  address,
  prefixLength = 8,
  suffixLength = 6,
}) => {
  const [copied, setCopied] = useState(false);
  if (!(address?.length > 0)) return;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="relative rounded text-gray-200 bg-primary-foreground px-3 py-1 font-mono text-sm font-semibold">
        {truncate(address, { prefixLength, suffixLength })}
      </code>
      <Button
        onClick={copyToClipboard}
        className="w-7 h-7 p-1.5"
        size="icon"
        variant="ghost"
      >
        <Icons.copy />
      </Button>
    </div>
  );
};

export default Address;
