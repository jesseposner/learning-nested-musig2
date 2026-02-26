import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, randomBytes } from '@noble/hashes/utils';
import { mod as noblemod } from '@noble/curves/abstract/modular';
import { bytesToNumberBE, numberToBytesBE } from '@noble/curves/abstract/utils';

// Group order. Paper calls this "p".
export const N = secp256k1.CURVE.n;

// Generator point. Paper calls this "g".
export const G = secp256k1.ProjectivePoint.BASE;

// Point type alias
export type Point = InstanceType<typeof secp256k1.ProjectivePoint>;

// Number of nonces. Paper calls this "ν".
export const NU = 2;

export function mod(a: bigint): bigint {
	return noblemod(a, N);
}

export function modAdd(a: bigint, b: bigint): bigint {
	return mod(a + b);
}

export function modMul(a: bigint, b: bigint): bigint {
	return mod(a * b);
}

// Square-and-multiply, mod N.
export function modPow(base: bigint, exp: bigint): bigint {
	let result = 1n;
	let curBase = mod(base);
	let curExp = exp;
	while (curExp > 0n) {
		if (curExp & 1n) {
			result = modMul(result, curBase);
		}
		curExp >>= 1n;
		curBase = modMul(curBase, curBase);
	}
	return result;
}

// Compressed point: 33 bytes.
export function serializePoint(P: Point): Uint8Array {
	return P.toRawBytes(true);
}

// Scalar: 32 bytes big-endian.
export function serializeScalar(s: bigint): Uint8Array {
	return numberToBytesBE(s, 32);
}

// Concatenate serialized points in order.
export function serializePointList(L: Point[]): Uint8Array {
	return concatBytes(...L.map(serializePoint));
}

// Parse bytes as big-endian scalar.
export function bytesToScalar(b: Uint8Array): bigint {
	return bytesToNumberBE(b);
}

const tagHashCache = new Map<string, Uint8Array>();

// BIP-340 tagged hash.
export function taggedHash(tag: string, ...data: Uint8Array[]): Uint8Array {
	let tagHash = tagHashCache.get(tag);
	if (!tagHash) {
		tagHash = sha256(new TextEncoder().encode(tag));
		tagHashCache.set(tag, tagHash);
	}
	return sha256(concatBytes(tagHash, tagHash, ...data));
}

export function taggedHashScalar(tag: string, ...data: Uint8Array[]): bigint {
	return mod(bytesToScalar(taggedHash(tag, ...data)));
}

// Random scalar in [1, N-1].
export function randomScalar(): bigint {
	while (true) {
		const bytes = randomBytes(32);
		const n = bytesToScalar(bytes);
		if (n > 0n && n < N) {
			return n;
		}
	}
}

export function deserializePoint(bytes: Uint8Array): Point {
	return secp256k1.ProjectivePoint.fromHex(bytes);
}

export { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
