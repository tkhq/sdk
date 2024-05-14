/**
 * Compute the modular square root using the Tonelli-Shanks algorithm.
 */
export const modSqrt = (x: bigint, p: bigint): bigint => {
  if (p <= BigInt(0)) {
    throw new Error("p must be positive");
  }
  const base = x % p;

  // Check if p % 4 == 3 (applies to NIST curves P-256, P-384, and P-521)
  if (testBit(p, 0) && testBit(p, 1)) {
    const q = (p + BigInt(1)) >> BigInt(2);
    const squareRoot = modPow(base, q, p);
    if ((squareRoot * squareRoot) % p !== base) {
      throw new Error("could not find a modular square root");
    }
    return squareRoot;
  }

  // Other elliptic curve types not supported
  throw new Error("unsupported modulus value");
};

/**
 * Test if a specific bit is set.
 */
export const testBit = (n: bigint, i: number): boolean => {
  const m = BigInt(1) << BigInt(i);
  return (n & m) !== BigInt(0);
};

/**
 * Compute the modular exponentiation.
 */
const modPow = (b: bigint, exp: bigint, p: bigint): bigint => {
  if (exp === BigInt(0)) {
    return BigInt(1);
  }
  let result = b;
  const exponentBitString = exp.toString(2);
  for (let i = 1; i < exponentBitString.length; ++i) {
    result = (result * result) % p;
    if (exponentBitString[i] === "1") {
      result = (result * b) % p;
    }
  }
  return result;
};
