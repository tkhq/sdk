declare module "cbor-js" {
  export function encode(value: any): ArrayBuffer;
  export function decode(data: ArrayBuffer): any;
}
