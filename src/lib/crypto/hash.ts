import { concatBytes } from '@noble/hashes/utils';
import { taggedHashScalar, serializePoint, serializePointList, type Point } from './utils';

function compareBytes(a: Uint8Array, b: Uint8Array): number {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) {
			return a[i] - b[i];
		}
	}
	return a.length - b.length;
}

function serializeKeyMultiset(L: Point[]): Uint8Array {
	const keys = L.map((key) => serializePoint(key));
	keys.sort(compareBytes);
	return concatBytes(...keys);
}

export function H_agg(L: Point[], Xi: Point): bigint {
	return taggedHashScalar('NestedMuSig2/agg', serializeKeyMultiset(L), serializePoint(Xi));
}

export function H_non(Xtilde: Point, Rs: Point[]): bigint {
	return taggedHashScalar('NestedMuSig2/non', serializePoint(Xtilde), serializePointList(Rs));
}

export function H_non_bar(Xtilde: Point, Rs: Point[], m: Uint8Array): bigint {
	return taggedHashScalar('NestedMuSig2/non_bar', serializePoint(Xtilde), serializePointList(Rs), m);
}

export function H_sig(Xtilde: Point, R: Point, m: Uint8Array): bigint {
	return taggedHashScalar('NestedMuSig2/sig', serializePoint(Xtilde), serializePoint(R), m);
}
