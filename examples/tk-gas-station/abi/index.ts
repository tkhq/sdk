export const POLYGON_CHAIN_ID = 137 as const;

export const GASSY_STATION_ADDRESS_POLYGON = "0x985FC9ea9Ef6CAD9eAB2FAc340dBdBEDF0d144c2" as const;
export const GASSY_ADDRESS_POLYGON = "0xAf67b50A0075AeC21B3e62ee6E42bC24aC791A24" as const;

export const CONTRACT_ADDRESSES: Record<number, { gassyStation: string; gassy: string }> = {
  [POLYGON_CHAIN_ID]: {
    gassyStation: GASSY_STATION_ADDRESS_POLYGON,
    gassy: GASSY_ADDRESS_POLYGON,
  },
};

export { gassyAbi, type GassyAbi } from "./gassy-abi";
export { gassyStationAbi, type GassyStationAbi } from "./gassy-station-abi";
