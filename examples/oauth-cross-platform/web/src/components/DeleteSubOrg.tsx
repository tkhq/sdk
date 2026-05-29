"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";

export function DeleteSubOrg() {
    const { session, logout, httpClient } = useTurnkey();
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDelete = async () => {
        if (!session?.organizationId) return;
        try {
            setDeleting(true);
            setError(null);
            await httpClient!.deleteSubOrganization({
                organizationId: session.organizationId,
                deleteWithoutExport: true,
            });
            await logout();
            router.replace("/");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to delete account.");
            setDeleting(false);
            setConfirming(false);
        }
    };

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                className="text-xs text-red-500 hover:text-red-400 underline"
            >
                Delete account
            </button>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600">
                This permanently deletes your sub-organization and all associated wallets. It cannot be undone.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
                <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="rounded bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                >
                    {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-800 hover:border-gray-800 hover:text-white disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

