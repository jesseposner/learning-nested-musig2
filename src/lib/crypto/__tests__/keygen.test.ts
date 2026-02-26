import { describe, expect, it } from 'vitest';
import { G } from '../utils';
import { H_agg } from '../hash';
import { keyAgg, keyAggCoef, keyGen } from '../keygen';

describe('key generation and aggregation', () => {
	it('KeyGen produces pk = G * sk', () => {
		const { sk, pk } = keyGen();
		expect(pk.equals(G.multiply(sk))).toBe(true);
	});

	it('KeyAggCoef is deterministic for same inputs', () => {
		const k1 = keyGen();
		const k2 = keyGen();
		const k3 = keyGen();
		const L = [k1.pk, k2.pk, k3.pk];
		const c1 = keyAggCoef(L, k2.pk);
		const c2 = keyAggCoef(L, k2.pk);
		expect(c1).toBe(c2);
	});

	it('KeyAgg of a single key is X^{H_agg({X}, X)}', () => {
		const { pk } = keyGen();
		const L = [pk];
		const expected = pk.multiply(H_agg(L, pk));
		const actual = keyAgg(L);
		expect(actual.equals(expected)).toBe(true);
	});

	it('KeyAgg of two keys matches manual weighted sum', () => {
		const a = keyGen();
		const b = keyGen();
		const L = [a.pk, b.pk];
		const a1 = keyAggCoef(L, a.pk);
		const a2 = keyAggCoef(L, b.pk);
		const expected = a.pk.multiply(a1).add(b.pk.multiply(a2));
		const actual = keyAgg(L);
		expect(actual.equals(expected)).toBe(true);
	});
});
