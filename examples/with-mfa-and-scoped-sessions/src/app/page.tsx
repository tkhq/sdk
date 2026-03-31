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
    <main className="flex flex-col min-h-[100dvh]">
      <div className="flex flex-row items-center justify-center gap-2 w-full py-2 bg-amber-200 overflow-x-auto">
        {scenarios.map((s, i) => (
          <button
            key={s.sessionKey}
            onClick={() => handleSelectScenario(i)}
            className={`rounded px-4 py-2 text-white ${
              activeIndex === i
                ? "bg-blue-800"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col flex-1 items-center justify-center">
        {clientState === ClientState.Loading && (
          <div className="text-sm text-gray-600">Initializing…</div>
        )}

        {clientState === ClientState.Error && (
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-gray-900 px-4 py-2 text-white"
          >
            Something went wrong. Reload
          </button>
        )}

        {clientState === ClientState.Ready && <Component />}
      </div>
    </main>
  );
}
