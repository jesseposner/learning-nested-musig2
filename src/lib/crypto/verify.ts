import { G, type Point } from './utils';
import { H_sig } from './hash';
import type { Signature } from './agg-prime';

export function verify(Xtilde: Point, m: Uint8Array, sigma: Signature): boolean {
	const { R, s } = sigma;
	const c = H_sig(Xtilde, R, m);
	const lhs = G.multiply(s);
	const rhs = R.add(Xtilde.multiply(c));
	return lhs.equals(rhs);
}
