import { fetch } from "../universal";
import { test, expect, jest } from "@jest/globals";
import { TurnkeyBrowserSDK } from "../index";

import { WebauthnStamper } from "@turnkey/webauthn-stamper";

jest.mock("cross-fetch");

jest.mock("@turnkey/webauthn-stamper");
// jest.mock("@turnkey/webauthn-stamper", () => {
//   return {
//     stamp: (_: any) => {
//       return 0;
//     },
//   };
// });

// Ugly but necessary: we mock webauthn assertions to return a static value
// This lets us assert against it.
// jest.mock("../webauthn-json", () => {
//   return {
//     get: (_: any) => {
//       return {
//         toJSON: () => {
//           return {
//             id: "credential-id",
//             response: {
//               authenticatorData: "authenticator-data",
//               clientDataJSON: "client-data-json",
//               signature: "the-signature",
//             },
//           };
//         },
//       };
//     },
//   };
// });

test("requests are stamped after client creation", async () => {
  const turnkeyBrowserClient = new TurnkeyBrowserSDK({
    apiBaseUrl: "https://mocked.turnkey.com",
    rpId: "https://turnkey.com",
    defaultOrganizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response: any = {};
  response.status = 200;
  response.ok = true;
  response.json = async () => ({});

  mockedFetch.mockReturnValue(Promise.resolve(response));

  const passkeySigner = await turnkeyBrowserClient.passkeySigner();

  await passkeySigner.getWhoami({
    organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  expect(fetch).toHaveBeenCalledTimes(1);

  const stamp = (mockedFetch.mock.lastCall![1]?.headers as any)?.[
    "X-Stamp-WebAuthn"
  ];
  expect(stamp).toBeTruthy();
});

test("requests return grpc status details as part of their errors", async () => {
  const turnkeyBrowserClient = new TurnkeyBrowserSDK({
    apiBaseUrl: "https://mocked.turnkey.com",
    rpId: "https://turnkey.com",
    defaultOrganizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
  });

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  const response: any = {};
  response.status = 200;
  response.ok = false;
  response.json = async () => ({
    code: 1,
    message: "invalid request",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        fieldViolations: [
          {
            field: "privateKeys.0.privateKeyName",
            description: "This field must be unique.",
          },
        ],
      },
    ],
  });

  mockedFetch.mockReturnValue(Promise.resolve(response));

  try {
    // Arbitrary request
    const passkeySigner = await turnkeyBrowserClient.passkeySigner();

    await passkeySigner.getWhoami({
      organizationId: "89881fc7-6ff3-4b43-b962-916698f8ff58",
    });
  } catch (e: any) {
    expect(e.message).toEqual(
      `Turnkey error 1: invalid request (Details: [{\"@type\":\"type.googleapis.com/google.rpc.BadRequest\",\"fieldViolations\":[{\"field\":\"privateKeys.0.privateKeyName\",\"description\":\"This field must be unique.\"}]}])`
    );
    expect(e.details.length).toEqual(1);
    expect(e.details[0].fieldViolations.length).toEqual(1);
    expect(e.details[0].fieldViolations[0].field).toEqual(
      "privateKeys.0.privateKeyName"
    );
    expect(e.details[0].fieldViolations[0].description).toEqual(
      "This field must be unique."
    );
  }
});
