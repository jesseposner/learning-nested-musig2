import { NU, modPow, type Point } from './utils';
import { H_non } from './hash';
import type { Round1Output } from './sign';

export function signAgg(outs: Round1Output[]): Point[] {
	if (outs.length === 0) {
		throw new Error('signAgg requires at least one round-1 output');
	}
	const result: Point[] = [];
	for (let j = 0; j < NU; j++) {
		let Rj = outs[0].nonces[j];
		for (let i = 1; i < outs.length; i++) {
			Rj = Rj.add(outs[i].nonces[j]);
		}
		result.push(Rj);
	}
	return result;
}

export function signAggExt(internalAgg: Point[], Xtilde: Point): { bound: Point[]; b: bigint } {
	const b = H_non(Xtilde, internalAgg);
	const bound: Point[] = [];
	for (let j = 0; j < NU; j++) {
		const exp = modPow(b, BigInt(j));
		bound.push(internalAgg[j].multiply(exp));
	}
	return { bound, b };
}
