import { G, NU, randomScalar, type Point } from './utils';

export interface Round1Output {
	nonces: Point[];
}

export interface Round1State {
	secrets: bigint[];
}

export function sign(): { out: Round1Output; state: Round1State } {
	const secrets: bigint[] = [];
	const nonces: Point[] = [];
	for (let j = 0; j < NU; j++) {
		const r = randomScalar();
		secrets.push(r);
		nonces.push(G.multiply(r));
	}
	return {
		out: { nonces },
		state: { secrets }
	};
}
