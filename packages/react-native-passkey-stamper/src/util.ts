// Buffer is available in Node and react-native contexts but needs to be imported
import { Buffer } from "buffer";
import { createHash } from "sha256-uint8array";

// Needs to return a base64-encoded string
export function getChallengeFromPayload(payload: string): string {
  const hexString = createHash().update(payload).digest("hex");
  const hexBuffer = Buffer.from(hexString, "utf8");
  return hexBuffer.toString("base64");
}

// Function to return 32 random bytes encoded as hex
// (e.g "5e4c2c235fc876a9bef433506cf596f2f7db19a959e3e30c5a2d965ec149d40f")
// ----
// Important note: this function doesn't return strong cryptographic randomness (Math.random is a PRNG),
// but this is good enough for registration challenges.
// If the challenge was not random at all the risk is that someone can replay a previous
// signature to register an authenticator they don't own. However:
// - we are creating a brand new authenticator here, which means keygen is happening right as we call this library
//   (this makes the replay attack hard-to-impossible)
// - even if a replay attack went through, the authenticator wouldn't be usable given Turnkey has anti-replay in place in activity payloads
//   (there is a `timestampMs` in activity payloads, see https://docs.turnkey.com/api-introduction#queries-and-submissions)
// ----
// As for "why Math.random in the first place?": it lets us avoid a dependency on webcrypto + associated polyfills
// (in react-native webcrypto isn't available)
export function getRandomChallenge(): string {
  let randomHexChars: string[] = [];
  const hexChars = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ];

  for (let i = 0; i < 64; i++) {
    randomHexChars.push(hexChars[Math.floor(Math.random() * 16)]!);
  }
  return randomHexChars.join("");
}
