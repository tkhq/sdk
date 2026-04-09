import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import { serverEnv } from "@/lib/env";

let turnkey: TurnkeySDKServer | undefined;

function getTurnkeyClient() {
  if (!turnkey) {
    turnkey = new TurnkeySDKServer({
      apiBaseUrl: serverEnv.baseUrl,
      apiPublicKey: serverEnv.apiPublicKey,
      apiPrivateKey: serverEnv.apiPrivateKey,
      defaultOrganizationId: serverEnv.organizationId,
    });
  }

  return turnkey;
}

export async function getBalances(params: { address: string; caip2: string }) {
  const { balances = [] } = await getTurnkeyClient()
    .apiClient()
    .getWalletAddressBalances({
      organizationId: serverEnv.organizationId,
      address: params.address,
      // The SDK currently narrows CAIP-2 to a generated union; this example accepts runtime input.
      caip2: params.caip2 as any,
    });

  return balances;
}
