"use client";

type Props = {
  platform: string;
  orgId: string | null;
  onClose: () => void;
};

export function VerificationModal({ platform, orgId, onClose }: Props) {
  const found = !!orgId && orgId !== "not found";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Verification result — {platform}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {found ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-700">Found — same sub-org</p>
            <p className="font-mono text-xs text-gray-600 break-all bg-gray-50 rounded p-2">
              {orgId}
            </p>
            <p className="text-xs text-gray-500">
              A mobile app authenticating with the {platform} client ID would resolve
              to this sub-org and log in successfully.
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-600">{orgId ?? "Not found"}</p>
        )}

        <button
          onClick={onClose}
          className="w-full rounded border border-gray-300 bg-white py-2 text-xs font-medium text-gray-700 hover:bg-gray-800 hover:border-gray-800 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
