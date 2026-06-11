"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const { logout } = useTurnkey();
  const router = useRouter();

  const handleLogout = async () => {
    sessionStorage.removeItem("tk_oauth_claims");
    sessionStorage.removeItem("tk_is_new_account");
    await logout();
    router.replace("/");
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
    >
      Logout
    </button>
  );
}
