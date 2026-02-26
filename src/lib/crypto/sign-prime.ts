import { G, NU, modAdd, modMul, modPow, type Point } from './utils';
import { H_non, H_non_bar, H_sig } from './hash';
import { keyAgg, keyAggCoef } from './keygen';
import type { Round1State } from './sign';

export interface SignPrimeInput {
	state: Round1State;
	outs: Point[][];
	sk: bigint;
	m: Uint8Array;
	cosignerKeys: Point[][];
}

export interface SignPrimeOutput {
	s: bigint;
	R: Point;
}

export interface SignPrimeTrace {
	pk1: Point[];
	L: Point[][];
	a1: bigint[];
	b: bigint[];
	Xtilde: Point;
	R: Point;
	bCheck: bigint;
	c: bigint;
	cCheck: bigint;
	s1: bigint;
}

export function signPrime(input: SignPrimeInput): { result: SignPrimeOutput; trace: SignPrimeTrace } {
	const { state, outs, sk, m, cosignerKeys } = input;
	const Lambda = outs.length;

	if (Lambda === 0) {
		throw new Error('signPrime requires at least one out^d entry (out^0)');
	}
	if (cosignerKeys.length !== Lambda) {
		throw new Error('cosignerKeys length must match outs length');
	}
	if (state.secrets.length !== NU) {
		throw new Error("round-1 state already consumed or invalid nonce count");
	}
	for (let d = 0; d < Lambda; d++) {
		if (outs[d].length !== NU) {
			throw new Error(`outs[${d}] must have length ${NU}`);
		}
	}

	const r = [...state.secrets];
	state.secrets = [];

	const pk1: Point[] = new Array(Lambda);
	const Ls: Point[][] = new Array(Lambda);
	const a1: bigint[] = new Array(Lambda);
	const bValues: bigint[] = new Array(Lambda);

	pk1[Lambda - 1] = G.multiply(sk);
	Ls[Lambda - 1] = [pk1[Lambda - 1], ...cosignerKeys[Lambda - 1]];
	a1[Lambda - 1] = keyAggCoef(Ls[Lambda - 1], pk1[Lambda - 1]);

	if (Lambda >= 2) {
		pk1[Lambda - 2] = keyAgg(Ls[Lambda - 1]);
	}

	for (let d = Lambda - 2; d >= 0; d--) {
		bValues[d + 1] = H_non(pk1[d], outs[d + 1]);
		Ls[d] = [pk1[d], ...cosignerKeys[d]];
		a1[d] = keyAggCoef(Ls[d], pk1[d]);
		if (d > 0) {
			pk1[d - 1] = keyAgg(Ls[d]);
		}
	}

	const Xtilde = keyAgg(Ls[0]);
	const topNonces = outs[0];
	bValues[0] = H_non_bar(Xtilde, topNonces, m);

	let R = topNonces[0].multiply(modPow(bValues[0], 0n));
	for (let j = 1; j < NU; j++) {
		const exp = modPow(bValues[0], BigInt(j));
		R = R.add(topNonces[j].multiply(exp));
	}

	let bCheck = 1n;
	for (let ell = 0; ell < Lambda; ell++) {
		bCheck = modMul(bCheck, bValues[ell]);
	}

	const c = H_sig(Xtilde, R, m);

	let cCheck = c;
	for (let ell = 0; ell < Lambda; ell++) {
		cCheck = modMul(cCheck, a1[ell]);
	}

	let s1 = modMul(cCheck, sk);
	for (let j = 0; j < NU; j++) {
		const bPow = modPow(bCheck, BigInt(j));
		s1 = modAdd(s1, modMul(r[j], bPow));
	}

	return {
		result: { s: s1, R },
		trace: {
			pk1,
			L: Ls,
			a1,
			b: bValues,
			Xtilde,
			R,
			bCheck,
			c,
			cCheck,
			s1
		}
	};
}
