import { THttpConfig, TStamper } from "./__types__/base";
import { TurnkeySDKClientBase } from "./sdk-client-base";
import * as SdkApiTypes from "./__generated__/sdk_api_types";

export class TurnkeySDKClient extends TurnkeySDKClientBase {
  constructor(organizationId: string, httpConfig: THttpConfig, stamper: TStamper) {
    super(organizationId, httpConfig, stamper);
  }

  createNextWalletAccount = async (params: { walletId: string }): Promise<SdkApiTypes.TCreateWalletAccountsResponse> => {
    const walletAccounts = await this.getWalletAccounts({ walletId: params.walletId });
    const lastAccount = walletAccounts.accounts[walletAccounts.accounts.length - 1]!;
    const lastAccountPath = lastAccount.path.split("/");
    const lastAccountPathIndex = lastAccountPath[3]!.replace(/[^0-9]/g, '');
    const nextPathIndex = Number(lastAccountPathIndex) + 1;
    lastAccountPath[3] = `${nextPathIndex}'`;
    const nextAccountPath = lastAccountPath.join("/");
    return this.createWalletAccounts({
      walletId: params.walletId,
      accounts: [{
        curve: lastAccount.curve,
        pathFormat: lastAccount.pathFormat,
        addressFormat: lastAccount.addressFormat,
        path: nextAccountPath
      }]
    })
  }

}
