import * as bitcoin from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";

export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

type SupportedAddressType =
  | "TestnetP2WPKH"
  | "TestnetP2TR"
  | "MainnetP2WPKH"
  | "MainnetP2TR";

export function getNetwork(addressType: SupportedAddressType): bitcoin.Network {
  if (addressType === "MainnetP2TR" || addressType === "MainnetP2WPKH") {
    return bitcoin.networks.bitcoin;
  } else if (addressType === "TestnetP2TR" || addressType === "TestnetP2WPKH") {
    return bitcoin.networks.testnet;
  } else {
    throw new Error("should never happen if all addresses are covered above");
  }
}

export function isMainnet(network: bitcoin.Network): boolean {
  return network.bech32 === "bc";
}

/**
 * Verify that the address comes from the passed in publicKey
 * We do not support all types of addresses.
 * Throws is the address isn't related.
 * Returns the address type for convenience since we already went through the trouble of parsing it!
 */
export function parseAddressAgainstPublicKey(
  address: string,
  publicKey: string
): SupportedAddressType {
  const ECPair = ECPairFactory(ecc);
  const pair = ECPair.fromPublicKey(Buffer.from(publicKey, "hex"));

  if (address.startsWith("bc1")) {
    const p2trAddress = bitcoin.payments.p2tr({
      internalPubkey: pair.publicKey.slice(1, 33),
      network: bitcoin.networks.bitcoin,
    }).address!;
    if (address == p2trAddress) {
      return "MainnetP2TR";
    }

    const p2wpkhAddress = bitcoin.payments.p2wpkh({
      pubkey: pair.publicKey,
      network: bitcoin.networks.bitcoin,
    }).address!;
    if (address == p2wpkhAddress) {
      return "MainnetP2WPKH";
    }

    throw new Error(
      `Address ${address} not related to public key ${publicKey} (tried p2tr, p2wpkh)`
    );
  } else if (address.startsWith("tb1")) {
    const p2trAddress = bitcoin.payments.p2tr({
      internalPubkey: pair.publicKey.slice(1, 33),
      network: bitcoin.networks.testnet,
    }).address!;
    if (address == p2trAddress) {
      return "TestnetP2TR";
    }

    const p2wpkhAddress = bitcoin.payments.p2wpkh({
      pubkey: pair.publicKey,
      network: bitcoin.networks.testnet,
    }).address!;
    if (address == p2wpkhAddress) {
      return "TestnetP2WPKH";
    }

    throw new Error(
      `Address ${address} not related to public key ${publicKey} (tried p2tr, p2wpkh)`
    );
  } else {
    throw new Error(
      `Address ${address} doesn't start with bc1 or tb1; not yet supported by this demo!`
    );
  }
}
