"use client";

import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";
import { useState } from "react";
import Scenario1, { SESSION_KEY as KEY1 } from "./scenarios/Scenario1";
import Scenario2, { SESSION_KEY as KEY2 } from "./scenarios/Scenario2";
import Scenario3, { SESSION_KEY as KEY3 } from "./scenarios/Scenario3";

const scenarios = [
  { label: "Scenario 1", sessionKey: KEY1, Component: Scenario1 },
  { label: "Scenario 2", sessionKey: KEY2, Component: Scenario2 },
  { label: "Scenario 3", sessionKey: KEY3, Component: Scenario3 },
];

export default function AuthPage() {
  const { clientState, allSessions, setActiveSession } = useTurnkey();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSelectScenario = async (index: number) => {
    const key = scenarios[index].sessionKey;
    if (clientState === ClientState.Ready && allSessions?.[key]) {
      await setActiveSession({ sessionKey: key });
    }
    setActiveIndex(index);
  };

  const { Component } = scenarios[activeIndex];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gray-50 text-black">
      <div className="sticky top-0 z-10 flex w-full flex-row items-center justify-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-3 overflow-x-auto">
        {scenarios.map((s, i) => (
          <button
            key={s.sessionKey}
            onClick={() => handleSelectScenario(i)}
            className={`rounded px-4 py-2 text-sm font-medium ${
              activeIndex === i
                ? "bg-gray-200 text-black"
                : "border border-gray-300 bg-white text-black hover:bg-gray-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {clientState === ClientState.Loading && (
          <div className="text-sm text-black">Initializing…</div>
        )}

        {clientState === ClientState.Error && (
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-gray-200 px-4 py-2 text-black"
          >
            Something went wrong. Reload
          </button>
        )}

        {clientState === ClientState.Ready && <Component />}
      </div>
    </main>
  );
}
