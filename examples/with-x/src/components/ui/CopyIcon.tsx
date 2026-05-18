"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyIcon({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  if (copied) {
    return (
      <svg
        className="w-4 h-4 text-green-600"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-label="Copied"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={handleCopy}
      aria-label={title ?? "Copy"}
      title={title ?? "Copy"}
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </Button>
  );
}
