import type { TSignedRequest } from "@turnkey/http";

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

export async function forwardRequestToTurnkey(signedRequest: TSignedRequest) {
  const tkRes = await fetch(signedRequest.url, {
    method: "POST",
    body: signedRequest.body,
    headers: {
      [signedRequest.stamp.stampHeaderName]:
        signedRequest.stamp.stampHeaderValue,
    },
  });

  return tkRes;
}
