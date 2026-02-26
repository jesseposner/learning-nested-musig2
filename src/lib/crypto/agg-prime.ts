import { mod, type Point } from './utils';

export interface Signature {
	R: Point;
	s: bigint;
}

export function signAggPrime(partialSigs: bigint[], R: Point): Signature {
	let s = 0n;
	for (const si of partialSigs) {
		s = mod(s + si);
	}
	return { R, s };
}
