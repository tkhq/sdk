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
      caip2: params.caip2,
    });

  return balances;
}
