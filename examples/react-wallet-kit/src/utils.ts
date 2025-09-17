import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { Buffer } from "buffer";

import { createPublicClient, http, verifyMessage } from "viem";
import { mainnet } from "viem/chains";
import {
  normalizePadding,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

// Custom hook to get the current screen size
export function useScreenSize() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,
    isMobile: width < 640,
  };
}

// Utility to get theme based on modal background
export function completeTheme(modalBackgroundColour: string) {
  const { L, C, h } = hexToOklch(modalBackgroundColour);

  const isLight = L > 0.7;

  const iconBackgroundLMultiplier = isLight ? 0.8 : 1.5;
  const iconTextLMultiplier = isLight ? 0.3 : 6;
  const buttonBackgroundLMultiplier = isLight ? 1.1 : 1.3;
  const backgroundLMultiplier = isLight ? 0.85 : 0.9;
  const draggableBackgroundLMultiplier = isLight ? 0.9 : 0.7;
  const panelBackgroundLMultiplier = isLight ? 0.95 : 0.7;

  const iconBackgroundL = isLight
    ? Math.max(L * iconBackgroundLMultiplier, 0.95)
    : Math.max(L * iconBackgroundLMultiplier, 0.2);
  const iconTextL = isLight
    ? Math.min(L * iconTextLMultiplier, 0.9)
    : Math.max(L * iconTextLMultiplier, 0.7);

  const buttonBackgroundL = isLight
    ? Math.min(L * buttonBackgroundLMultiplier, 0.95)
    : Math.max(L * buttonBackgroundLMultiplier, 0.2);

  const backgroundL = isLight
    ? L > 0.9
      ? 0.9
      : Math.min(L * backgroundLMultiplier, 0.9)
    : Math.max(L * backgroundLMultiplier, 0.25);
  const draggableBackgroundL = isLight
    ? Math.min(L * draggableBackgroundLMultiplier, 0.9)
    : Math.max(L * draggableBackgroundLMultiplier, 0.3);
  const panelBackgroundL = isLight
    ? Math.min(L * panelBackgroundLMultiplier, 1)
    : Math.max(L * panelBackgroundLMultiplier, 0.2);

  const iconBackground = oklchToHex({ L: iconBackgroundL, C, h });
  const iconText = oklchToHex({ L: iconTextL, C, h });
  const buttonBackground = oklchToHex({ L: buttonBackgroundL, C, h });
  const background = oklchToHex({ L: backgroundL, C, h });
  const draggableBackground = oklchToHex({ L: draggableBackgroundL, C, h });
  const panelBackground = oklchToHex({ L: panelBackgroundL, C, h });

  return {
    iconBackground,
    iconText,
    buttonBackground,
    background,
    draggableBackground,
    panelBackground,
  };
}

// Utility to get primary-text color based on primary-colour
export function textColour(colour: string, highContrast = false) {
  // Use OKLCh for perceptual lightness
  const { L, C, h } = hexToOklch(colour);
  const isLight = L > 0.5;

  // Use pure black or white for maximum contrast
  return isLight
    ? oklchToHex({ L: !highContrast ? 0.2 : 0.05, C, h })
    : oklchToHex({ L: !highContrast ? 0.9 : 1.5, C, h });
}

export function logoColour(colour: string) {
  // Use OKLCh for perceptual lightness
  const { L, C, h } = hexToOklch(colour);
  const isLight = L > 0.6;

  // Use a slightly darker or lighter shade for logo
  return isLight ? oklchToHex({ L: 0.5, C, h }) : oklchToHex({ L: 0.7, C, h });
}

// parse a hex string into [r,g,b] in 0–1
function hexToRgb01(hex: string) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.replace(/(.)/g, "$1$1");
  const int = parseInt(hex, 16);
  return [
    ((int >> 16) & 0xff) / 255,
    ((int >> 8) & 0xff) / 255,
    (int & 0xff) / 255,
  ];
}

// linearize an sRGB channel
function srgbToLinear(u: number) {
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

// gamma-correct a linear channel
function linearToSrgb(u: number) {
  return u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
}

// multiply a 3×3 matrix by a 3-vector
function mat3Mul(mat: number[], [x, y, z]: [number, number, number]) {
  return [
    mat[0] * x + mat[1] * y + mat[2] * z,
    mat[3] * x + mat[4] * y + mat[5] * z,
    mat[6] * x + mat[7] * y + mat[8] * z,
  ];
}

// clamp to [0,1]
function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ---- Core Conversions ----

// linear sRGB → OKLab
function linearSrgbToOklab([lr, lg, lb]: [number, number, number]) {
  // first to LMS
  let [l_, m_, s_] = mat3Mul(
    [
      0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451,
      0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005,
    ],
    [lr, lg, lb],
  );

  // cube-root
  let l = Math.cbrt(l_),
    m = Math.cbrt(m_),
    s = Math.cbrt(s_);

  // to OKLab
  return mat3Mul(
    [
      0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205,
      0.4505937099, 0.0259040371, 0.7827717662, -0.808675766,
    ],
    [l, m, s],
  );
}

// OKLab → linear sRGB
function oklabToLinearSrgb([L, a, b]: [number, number, number]) {
  // first to LMS-cube
  let l = L + 0.3963377774 * a + 0.2158037573 * b;
  let m = L - 0.1055613458 * a - 0.0638541728 * b;
  let s = L - 0.0894841775 * a - 1.291485548 * b;

  // cube
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;

  // back to linear RGB
  return mat3Mul(
    [
      4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011,
      -0.3413193965, -0.0041960863, -0.7034186147, 1.707614701,
    ],
    [l, m, s],
  );
}

// ---- Public API ----

/**
 * Convert a hex color to OKLCh.
 * @param {string} hex – e.g. "#ff00aa" or "abc"
 * @returns {{L:number,C:number,h:number}}
 */
function hexToOklch(hex: string) {
  // parse, linearize
  const rgb01 = hexToRgb01(hex).map(srgbToLinear) as [number, number, number];
  // to OKLab
  let [L, a, b] = linearSrgbToOklab(rgb01);
  // to cylindrical LCh
  let C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/**
 * Convert OKLCh back to hex.
 * @param {{L:number,C:number,h:number}} oklch
 * @returns {string} – a 7-char "#rrggbb"
 */
function oklchToHex({ L, C, h }: { L: number; C: number; h: number }) {
  // cylindrical → OKLab
  let a = C * Math.cos((h * Math.PI) / 180);
  let b = C * Math.sin((h * Math.PI) / 180);
  // to linear RGB
  let [lr, lg, lb] = oklabToLinearSrgb([L, a, b]);
  // gamma-correct & clamp & scale
  const to255 = (x: number) => Math.round(clamp01(linearToSrgb(x)) * 255);
  let r = to255(lr),
    g = to255(lg),
    b8 = to255(lb);
  // hex
  return "#" + [r, g, b8].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Utility to joins r, s, v components into a single hex-encoded signature string
function joinRSV(r: string, s: string, v: string | number): `0x${string}` {
  // we normalize input (strip 0x if present)
  const rHex = r.startsWith("0x") ? r.slice(2) : r;
  const sHex = s.startsWith("0x") ? s.slice(2) : s;
  const vHex =
    typeof v === "number"
      ? v.toString(16)
      : v.startsWith("0x")
        ? v.slice(2)
        : v;

  // convert to bytes
  const rBytes = uint8ArrayFromHexString(rHex);
  const sBytes = uint8ArrayFromHexString(sHex);
  const vBytes = uint8ArrayFromHexString(vHex);

  // pad to proper lengths
  const rPadded = normalizePadding(rBytes, 32);
  const sPadded = normalizePadding(sBytes, 32);
  const vPadded = normalizePadding(vBytes, 1);

  // concatenate r + s + v
  const signatureBytes = new Uint8Array(
    rPadded.length + sPadded.length + vPadded.length,
  );
  signatureBytes.set(rPadded, 0);
  signatureBytes.set(sPadded, rPadded.length);
  signatureBytes.set(vPadded, rPadded.length + sPadded.length);

  // we convert back to hex
  return `0x${uint8ArrayToHexString(signatureBytes)}` as `0x${string}`;
}

/**
 * Verifies an Ethereum signature and returns the address it was signed with.
 * @param {string} message - The original message that was signed.
 * @param {string} r - The r value of the signature.
 * @param {string} s - The s value of the signature.
 * @param {string} v - The v value of the signature.
 * @param {string} address - The Ethereum address of the signer.
 * @returns {boolean} - True if the signature is valid, false otherwise.
 */
export async function verifyEthSignatureWithAddress(
  message: string,
  r: string,
  s: string,
  v: string | number,
  address: `0x${string}`,
): Promise<boolean> {
  try {
    const signature = joinRSV(r, s, v);
    return await client.verifyMessage({
      address,
      message,
      signature,
    });
  } catch (error) {
    console.error("Ethereum signature verification failed:", error);
    return false;
  }
}

/**
 * Verifies a Solana signature using the address (treated as the public key).
 * @param {string} message - The original message that was signed.
 * @param {string} r - The r value of the signature.
 * @param {string} s - The s value of the signature.
 * @param {string} address - The Solana address of the signer.
 * @returns {boolean} - True if the signature is valid, false otherwise.
 */
export function verifySolSignatureWithAddress(
  message: string,
  r: string,
  s: string,
  address: string,
) {
  try {
    // Combine r and s as the full signature (64 bytes for Solana)
    const signatureBuffer = Buffer.from(r + s, "hex");
    const signature = new Uint8Array(signatureBuffer);

    // Convert the message to a Uint8Array
    const messageBuffer = new Uint8Array(Buffer.from(message));

    // Treat the address as the public key (if valid)
    const pubKey = new PublicKey(address);

    // Verify the signature
    return nacl.sign.detached.verify(
      messageBuffer,
      signature,
      pubKey.toBytes(),
    );
  } catch (error) {
    console.error("Solana signature verification failed:", error);
    return false;
  }
}

// Utility to check if hardware acceleration is enabled. Used for 3D background.
export function isHardwareAccelerationEnabled(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch (e) {
    return false;
  }
}

export function kebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
