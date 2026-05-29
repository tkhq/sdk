"use client";

type Platform = {
  label: string;
  clientId: string;
  verified: boolean;
};

type Props = {
  platforms: Platform[];
  hasClaims: boolean;
  verifying: Record<string, boolean>;
  onVerify: (platform: Platform) => void;
};

export function PlatformsCard({
  platforms,
  hasClaims,
  verifying,
  onVerify,
}: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">
        Registered platforms
      </h2>
      <div className="space-y-3">
        {platforms.map((p) => (
          <div
            key={p.label}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
          >
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {p.label}
                </span>
                {p.verified ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    verified
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    unverified claim
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-gray-500 truncate">
                {p.clientId}
              </p>
            </div>

            {!p.verified && hasClaims && (
              <button
                onClick={() => onVerify(p)}
                disabled={verifying[p.label]}
                className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {verifying[p.label] ? "Checking…" : "Verify access"}
              </button>
            )}
          </div>
        ))}
      </div>

      {!hasClaims && (
        <p className="mt-3 text-xs text-gray-400">
          Sign out and back in to load identity claims.
        </p>
      )}
    </section>
  );
}
