"use client";

import { useState, useEffect } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { verifyPlatformAction } from "@/server/actions/turnkey";
import { ExistingAccountWarning } from "./ExistingAccountWarning";

type Platform = {
  label: string;
  clientId: string;
  verified: boolean;
};

type Claims = { iss: string; sub: string };

type LinkStatus = "checking" | "linking" | "linked" | "error";

type Props = {
  platforms: Platform[];
  claims: Claims | null;
  currentSubOrgId: string | undefined;
  isNewAccount?: boolean | null;
};

export function LinkedPlatformsCard({
  platforms,
  claims,
  currentSubOrgId,
  isNewAccount,
}: Props) {
  const { httpClient, session } = useTurnkey();

  const [linkStatus, setLinkStatus] = useState<Record<string, LinkStatus>>({});
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!claims || !currentSubOrgId || !httpClient || !session?.userId) return;

    for (const p of platforms.filter((p) => !p.verified && !linkStatus[p.label])) {
      setLinkStatus((s) => ({ ...s, [p.label]: "checking" }));

      verifyPlatformAction({
        iss: claims.iss,
        sub: claims.sub,
        aud: p.clientId,
      })
        .then(async (result) => {
          const orgId = result.organizationIds?.[0];
          if (orgId === currentSubOrgId) {
            setLinkStatus((s) => ({ ...s, [p.label]: "linked" }));
            return;
          }
          if (orgId && orgId !== currentSubOrgId) {
            throw new Error(
              `This OIDC claim is already linked to a different sub-organization (${orgId}).`,
            );
          }
          setLinkStatus((s) => ({ ...s, [p.label]: "linking" }));
          await httpClient.createOauthProviders({
            organizationId: currentSubOrgId,
            userId: session.userId,
            oauthProviders: [
              {
                providerName: "Google",
                oidcClaims: {
                  iss: claims.iss,
                  sub: claims.sub,
                  aud: p.clientId,
                },
              },
            ],
          });
          setLinkStatus((s) => ({ ...s, [p.label]: "linked" }));
        })
        .catch((e: unknown) => {
          setLinkStatus((s) => ({ ...s, [p.label]: "error" }));
          setLinkErrors((prev) => ({
            ...prev,
            [p.label]:
              e instanceof Error ? e.message : "Failed to link platform.",
          }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, currentSubOrgId, httpClient, session?.userId]);

  return (
    <>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Registered platforms
        </h2>
        <div className="space-y-3">
          {platforms.map((p) => {
            const status = linkStatus[p.label];

            return (
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
                      <Badge
                        color="green"
                        title="Registered with a live OIDC token verified by Google's public keys"
                      >
                        verified
                      </Badge>
                    ) : status === "linked" ? (
                      <Badge
                        color="green"
                        title="Registered as an oidcClaim — trusted by association because it shares the same iss/sub as the verified token"
                      >
                        oidcClaim · linked
                      </Badge>
                    ) : status === "error" ? (
                      <Badge color="red">oidcClaim · error</Badge>
                    ) : !claims ? (
                      <Badge
                        color="yellow"
                        title="Sign out and back in to load identity claims."
                      >
                        oidcClaim · not loaded
                      </Badge>
                    ) : (
                      <Badge color="yellow">
                        {status === "linking"
                          ? "oidcClaim · linking…"
                          : "oidcClaim · checking…"}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-gray-500 truncate">
                    {p.clientId}
                  </p>
                  {linkErrors[p.label] && (
                    <p className="text-xs text-red-500 mt-1">
                      {linkErrors[p.label]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!claims && (
          <p className="mt-3 text-xs text-gray-400">
            Sign out and back in to load identity claims.
          </p>
        )}
      </section>

      {isNewAccount === false && Object.keys(linkErrors).length > 0 && (
        <ExistingAccountWarning />
      )}
    </>
  );
}

function Badge({
  color,
  title,
  children,
}: {
  color: "green" | "yellow" | "red";
  title?: string;
  children: React.ReactNode;
}) {
  const colors = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]} ${title ? "cursor-help" : ""}`}
      title={title}
    >
      {children}
    </span>
  );
}
