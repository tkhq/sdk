"use client";

import { useRouter } from "next/navigation";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useTurnkey();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
    router.replace("/");
  };

  return (
    <button
      onClick={handleLogout}
      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
    >
      Log Out
    </button>
  );
}
