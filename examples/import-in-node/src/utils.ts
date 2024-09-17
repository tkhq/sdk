import { uint8ArrayFromHexString } from "@turnkey/encoding";

export async function verifyEnclaveSignature(
    enclaveQuorumPublic: string,
    publicSignature:string,
    signedData:string
  ) {
    if (enclaveQuorumPublic != process.env.SIGNER_PUBLIC_KEY!){
      console.log(enclaveQuorumPublic)
      console.log(process.env.SIGNER_PUBLIC_KEY)
      throw new Error(
        "expected signer key does not match signer key from bundle"
      );
    }
  
    const encryptionQuorumPublicBuf = new Uint8Array(
      uint8ArrayFromHexString(enclaveQuorumPublic)
    );
    const quorumKey = await loadQuorumKey(encryptionQuorumPublicBuf);
    if (!quorumKey) {
      throw new Error("failed to load quorum key");
    }
  
    // The ECDSA signature is ASN.1 DER encoded but WebCrypto uses raw format
    const publicSignatureBuf = fromDerSignature(publicSignature);
    const signedDataBuf = uint8ArrayFromHexString(signedData);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      quorumKey,
      publicSignatureBuf,
      signedDataBuf
    );
  }
  
          /**
           * Converts an ASN.1 DER-encoded ECDSA signature to the raw format that WebCrypto uses.
           */
          function fromDerSignature(derSignature: string) {
            const derSignatureBuf = uint8ArrayFromHexString(derSignature);
  
            // Check and skip the sequence tag (0x30)
            let index = 2;
  
            // Parse 'r' and check for integer tag (0x02)
            if (derSignatureBuf[index] !== 0x02) {
              throw new Error(
                "failed to convert DER-encoded signature: invalid tag for r"
              );
            }
            index++; // Move past the INTEGER tag
            const rLength = derSignatureBuf[index];
            index++; // Move past the length byte
            const r = derSignatureBuf.slice(index, index + rLength!);
            index += rLength!; // Move to the start of s
  
            // Parse 's' and check for integer tag (0x02)
            if (derSignatureBuf[index] !== 0x02) {
              throw new Error(
                "failed to convert DER-encoded signature: invalid tag for s"
              );
            }
            index++; // Move past the INTEGER tag
            const sLength = derSignatureBuf[index];
            index++; // Move past the length byte
            const s = derSignatureBuf.slice(index, index + sLength!);
  
            // Normalize 'r' and 's' to 32 bytes each
            const rPadded = normalizePadding(r, 32);
            const sPadded = normalizePadding(s, 32);
  
            // Concatenate and return the raw signature
            return new Uint8Array([...rPadded, ...sPadded]);
          }
  
  
          /**
           * Function to normalize padding of byte array with 0's to a target length
           */
          function normalizePadding(byteArray: Uint8Array, targetLength: number) {
            const paddingLength = targetLength - byteArray.length;
  
            // Add leading 0's to array
            if (paddingLength > 0) {
              const padding = new Uint8Array(paddingLength).fill(0);
              return new Uint8Array([...padding, ...byteArray]);
            }
  
            // Remove leading 0's from array
            if (paddingLength < 0) {
              const expectedZeroCount = paddingLength * -1;
              let zeroCount = 0;
              for (
                let i = 0;
                i < expectedZeroCount && i < byteArray.length;
                i++
              ) {
                if (byteArray[i] === 0) {
                  zeroCount++;
                }
              }
              // Check if the number of zeros found equals the number of zeroes expected
              if (zeroCount !== expectedZeroCount) {
                throw new Error(
                  `invalid number of starting zeroes. Expected number of zeroes: ${expectedZeroCount}. Found: ${zeroCount}.`
                );
              }
              return byteArray.slice(
                expectedZeroCount,
                expectedZeroCount + targetLength
              );
            }
            return byteArray;
          }
  
  
    async function loadQuorumKey(quorumPublic: Uint8Array) {
      return await crypto.subtle.importKey(
        "raw",
        quorumPublic,
        {
          name: "ECDSA",
          namedCurve: "P-256",
        },
        true,
        ["verify"]
      );
    }
  