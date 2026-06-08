"use client";

type OauthClaims = { iss: string; sub: string };

type Props = {
  aud: string;
  claims: OauthClaims | null;
};

export function OidcCard({ aud, claims }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">OIDC</h2>
      {claims && (
        <>
          <Row label="Issuer (iss)" value={claims.iss} />
          <Row label="Subject (sub)" value={claims.sub} />
          <Row label="Audience (aud)" value={aud} />
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-mono text-xs text-gray-700 break-all">{value}</p>
    </div>
  );
}
