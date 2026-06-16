"use server";

/**
 * Proxy a pre-stamped Turnkey request to the Turnkey API.
 *
 * The client stamps the request using its session key (via httpClient.stamp*),
 * then sends the signed { url, body, stamp } to this server action.
 * The server forwards it to Turnkey — it never touches the user's private key.
 *
 * This pattern is useful when you want the server to:
 *  - Log or persist activity before/after it reaches Turnkey
 *  - Apply additional business logic or rate limiting
 *  - Broadcast transactions on behalf of the user after signing
 *
 * See: https://docs.turnkey.com/authentication/proxying-signed-requests
 */
export async function proxySignedRequestAction(params: {
  url: string;
  body: string;
  stampHeaderValue: string;
}) {
  const { url, body, stampHeaderValue } = params;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Stamp": stampHeaderValue,
    },
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Turnkey API error ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}
