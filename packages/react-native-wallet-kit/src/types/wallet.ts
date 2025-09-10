export interface Wallet {
  id: string;
  name: string;
  address: string;
  network: string;
}

export interface WalletBalance {
  symbol: string;
  amount: string;
  usdValue?: string;
}