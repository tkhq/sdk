export type CreateSubOrgResponse = {
  subOrgId: string;
  wallet: TFormattedWallet;
};

export type GetWalletRequest = {
  organizationId: string;
};

export type TFormattedWallet = {
  id: string;
  name: string;
  accounts: TFormattedWalletAccount[];
};

export type TFormattedWalletAccount = {
  address: string;
  path: string;
};
