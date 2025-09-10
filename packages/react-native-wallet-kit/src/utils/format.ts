export const formatAddress = (address: string, start: number = 6, end: number = 4): string => {
  if (address.length <= start + end) {
    return address;
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const formatCurrency = (amount: string | number, decimals: number = 2): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(decimals);
};