import { describe, expect, it } from 'vitest';
import { NU } from '../utils';
import { keyAgg, keyGen } from '../keygen';
import { sign } from '../sign';
import { signAgg } from '../agg';
import { signPrime } from '../sign-prime';
import { signAggPrime } from '../agg-prime';
import { verify } from '../verify';

const encoder = new TextEncoder();

describe('flat MuSig2 flow', () => {
	it('Sign round 1 produces NU nonces and matching secrets', () => {
		const { out, state } = sign();
		expect(out.nonces).toHaveLength(NU);
		expect(state.secrets).toHaveLength(NU);
	});

	it('SignAgg of 3 outputs produces NU aggregate nonces', () => {
		const a = sign();
		const b = sign();
		const c = sign();
		const agg = signAgg([a.out, b.out, c.out]);
		expect(agg).toHaveLength(NU);
	});

	it('Flat MuSig2 signature verifies and fails on wrong message', () => {
		const signers = [keyGen(), keyGen(), keyGen()];
		const L = signers.map((s) => s.pk);
		const Xtilde = keyAgg(L);
		const msg = encoder.encode('flat-musig2-message');
		const wrongMsg = encoder.encode('wrong-message');

		const r1 = signers.map(() => sign());
		const internal = signAgg(r1.map((r) => r.out));

		const partials = signers.map((signer, idx) => {
			const otherKeys = L.filter((_, i) => i !== idx);
			const { result } = signPrime({
				state: r1[idx].state,
				outs: [internal],
				sk: signer.sk,
				m: msg,
				cosignerKeys: [otherKeys]
			});
			return result;
		});

		const R = partials[0].R;
		for (let i = 1; i < partials.length; i++) {
			expect(partials[i].R.equals(R)).toBe(true);
		}

		const sigma = signAggPrime(
			partials.map((p) => p.s),
			R
		);
		expect(verify(Xtilde, msg, sigma)).toBe(true);
		expect(verify(Xtilde, wrongMsg, sigma)).toBe(false);
	});

	it('Sign\' consumes round-1 state and rejects reuse', () => {
		const signer = keyGen();
		const cosigner = keyGen();
		const msg = encoder.encode('state-consumption-test');
		const r1a = sign();
		const r1b = sign();
		const internal = signAgg([r1a.out, r1b.out]);

		const input = {
			state: r1a.state,
			outs: [internal],
			sk: signer.sk,
			m: msg,
			cosignerKeys: [[cosigner.pk]]
		};

		signPrime(input);
		expect(() => signPrime(input)).toThrow();
	});
});
