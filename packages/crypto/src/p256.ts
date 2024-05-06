// // Private crypto implementation for P256 public key derivation from a private key
// class P256FieldElement {
//   num: bigint;
//   prime: bigint;

//   constructor(num: bigint) {
//     this.num = num;
//     this.prime = BigInt(
//       "0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"
//     );
//   }

//   eq(other: P256FieldElement): boolean {
//     return this.num === other.num;
//   }

//   add(other: P256FieldElement): P256FieldElement {
//     const num = (this.num + other.num) % this.prime;
//     return new P256FieldElement(num);
//   }

//   sub(other: P256FieldElement): P256FieldElement {
//     let res = (this.num - other.num) % this.prime;
//     if (res < BigInt(0)) {
//       res += this.prime;
//     }
//     return new P256FieldElement(res);
//   }

//   mul(other: bigint | number | P256FieldElement): P256FieldElement {
//     let coefficient: bigint;
//     if (typeof other === "bigint") {
//       coefficient = other;
//     } else if (typeof other === "number") {
//       coefficient = BigInt(other);
//     } else if (other instanceof P256FieldElement) {
//       coefficient = other.num;
//     } else {
//       throw new Error(
//         "Cannot multiply element. Expected a BigInt, a Number, or a P256FieldElement. Got: " +
//           other
//       );
//     }
//     const num = (this.num * coefficient) % this.prime;
//     return new P256FieldElement(num);
//   }

//   div(other: P256FieldElement): P256FieldElement {
//     return new P256FieldElement(other.num)
//       .pow(this.prime - BigInt(2))
//       .mul(this.num);
//   }

//   pow(exponent: bigint): P256FieldElement {
//     let base = this.num % this.prime;
//     let result = 1n;
//     while (exponent > 0n) {
//       if (exponent % 2n) {
//         result = (result * base) % this.prime;
//       }
//       exponent /= 2n;
//       base = (base * base) % this.prime;
//     }
//     return new P256FieldElement(result);
//   }
// }

// class P256Point {
//   x: P256FieldElement;
//   y: P256FieldElement;
//   a: P256FieldElement;
//   b: P256FieldElement;

//   constructor(x: P256FieldElement | null, y: P256FieldElement | null) {
//     this.x = x!;
//     this.y = y!;
//     this.a = new P256FieldElement(
//       BigInt(
//         "0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"
//       )
//     );
//     this.b = new P256FieldElement(
//       BigInt(
//         "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"
//       )
//     );

//     if (this.x === null && this.y === null) {
//       // Point at infinity
//       return;
//     }

//     const left = this.y.pow(2n).num;
//     const right = this.x.pow(3n).add(this.x.mul(this.a)).add(this.b).num;

//     if (left !== right) {
//       // y**2 = x**3 + 7 is the elliptic curve equation
//       throw new Error(
//         "Not on the P256 curve! y**2 (" +
//           left +
//           ") != x3 + ax + b (" +
//           right +
//           ")"
//       );
//     }
//   }

//   add(other: P256Point): P256Point {
//     if (this.x === null) {
//       return other;
//     }
//     if (other.x === null) {
//       return this;
//     }

//     if (this.x.eq(other.x) && this.y.eq(this.y) === false) {
//       return new P256Point(null, null);
//     }

//     if (
//       this.x.eq(other.x) &&
//       this.y.eq(other.y) &&
//       this.y.eq(new P256FieldElement(0n))
//     ) {
//       return new P256Point(null, null);
//     }

//     if (this.x.eq(other.x) && this.y.eq(other.y)) {
//       const s = this.x.pow(2n).mul(3).add(this.a).div(this.y.mul(2));
//       const x = s.pow(2n).sub(this.x.mul(2));
//       const y = s.mul(this.x.sub(x)).sub(this.y);
//       return new P256Point(x, y) as this;
//     }

//     if (this.x.eq(other.x) === false) {
//       const s = other.y.sub(this.y).div(other.x.sub(this.x));
//       const x = s.pow(2n).sub(this.x).sub(other.x);
//       const y = s.mul(this.x.sub(x)).sub(this.y);
//       return new P256Point(x, y) as this;
//     }

//     throw new Error(
//       "Cannot handle addition of (" +
//         this.x +
//         ", " +
//         this.y +
//         ") with (" +
//         other.x +
//         ", " +
//         other.y +
//         ")"
//     );
//   }

//   multiply(coefficient: bigint): P256Point {
//     let coef = coefficient;
//     let current = this;
//     let result = new P256Point(null, null);
//     while (coef) {
//       if (coef & 1n) {
//         result = result.add(current);
//       }
//       current = current.add(current) as any;
//       coef >>= 1n;
//     }
//     return result;
//   }
// }

// export const P256Generator = new P256Point(
//   new P256FieldElement(
//     BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296")
//   ),
//   new P256FieldElement(
//     BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
//   )
// );
