"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { type ReactElement } from "react";

export default function LogoutButton(): ReactElement {
  const { logout } = useTurnkey();

  return (
    <button
      onClick={() => logout()}
      className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
    >
      Logout
    </button>
  );
}
