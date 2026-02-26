import { secp256k1 } from '@noble/curves/secp256k1';
import { G, randomScalar, type Point } from './utils';
import { H_agg } from './hash';

export interface KeyPair {
	sk: bigint;
	pk: Point;
}

export function keyGen(): KeyPair {
	const sk = randomScalar();
	const pk = G.multiply(sk);
	return { sk, pk };
}

export function keyAggCoef(L: Point[], Xi: Point): bigint {
	return H_agg(L, Xi);
}

export function keyAgg(L: Point[]): Point {
	if (L.length === 0) {
		throw new Error('keyAgg requires at least one public key');
	}
	const coeffs = L.map((Xi) => keyAggCoef(L, Xi));
	return secp256k1.ProjectivePoint.msm(L, coeffs);
}
