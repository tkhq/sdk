"use client";

import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";

export const SESSION_KEY = "scenario-3";

export default function Scenario3() {
  const { handleLogin, logout, allSessions, clientState } = useTurnkey();
  const session = allSessions?.[SESSION_KEY];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Scenario 3</h2>
      <p className="text-sm text-gray-500">Placeholder text for scenario 3.</p>

      {session && (
        <div className="text-xs text-gray-400 font-mono text-center">
          <div>User: {session.userId}</div>
          <div>Org: {session.organizationId}</div>
        </div>
      )}

      {clientState === ClientState.Ready && !session && (
        <button
          onClick={() => handleLogin({ sessionKey: SESSION_KEY })}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Login / Sign Up
        </button>
      )}

      {clientState === ClientState.Ready && session && (
        <button
          onClick={() => logout({ sessionKey: SESSION_KEY })}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Logout
        </button>
      )}
    </div>
  );
}
