import { describe, expect, it } from 'vitest';
import type { Point } from '../utils';
import type { Round1Output, Round1State } from '../sign';
import { keyAgg, keyGen } from '../keygen';
import { sign } from '../sign';
import { signAgg, signAggExt } from '../agg';
import { signPrime } from '../sign-prime';
import { signAggPrime, type Signature } from '../agg-prime';
import { verify } from '../verify';

type LeafNode = {
	id: string;
	kind: 'leaf';
	sk?: bigint;
	pk?: Point;
	round1Out?: Round1Output;
	round1State?: Round1State;
	partialSig?: bigint;
	R?: Point;
};

type AggNode = {
	id: string;
	kind: 'aggregator';
	children: TestNode[];
	pk?: Point;
	internalAgg?: Point[];
	round1Out?: Round1Output;
	partialSig?: bigint;
	R?: Point;
};

type TestNode = LeafNode | AggNode;

type PathEntry = {
	agg: AggNode;
	childIndex: number;
};

type LeafPath = {
	leaf: LeafNode;
	path: PathEntry[];
};

const encoder = new TextEncoder();

function leaf(id: string): LeafNode {
	return { id, kind: 'leaf' };
}

function agg(id: string, children: TestNode[]): AggNode {
	return { id, kind: 'aggregator', children };
}

function isLeaf(node: TestNode): node is LeafNode {
	return node.kind === 'leaf';
}

function keyGenTree(node: TestNode): void {
	if (isLeaf(node)) {
		const kp = keyGen();
		node.sk = kp.sk;
		node.pk = kp.pk;
		return;
	}
	for (const child of node.children) {
		keyGenTree(child);
	}
	node.pk = keyAgg(node.children.map((child) => child.pk!));
}

function round1Tree(node: TestNode): Round1Output {
	if (isLeaf(node)) {
		const { out, state } = sign();
		node.round1Out = out;
		node.round1State = state;
		return out;
	}
	const childOuts = node.children.map((child) => round1Tree(child));
	const internalAgg = signAgg(childOuts);
	const { bound } = signAggExt(internalAgg, node.pk!);
	node.internalAgg = internalAgg;
	node.round1Out = { nonces: bound };
	return node.round1Out;
}

function collectLeafPaths(node: TestNode, path: PathEntry[] = []): LeafPath[] {
	if (isLeaf(node)) {
		return [{ leaf: node, path }];
	}
	return node.children.flatMap((child, childIndex) => {
		return collectLeafPaths(child, [...path, { agg: node, childIndex }]);
	});
}

function round2Leaves(root: AggNode, m: Uint8Array): void {
	const leafPaths = collectLeafPaths(root);
	for (const { leaf: leafNode, path } of leafPaths) {
		const outs = path.map((entry) => entry.agg.internalAgg!);
		const cosignerKeys = path.map((entry) => {
			const siblings = entry.agg.children.filter((_, idx) => idx !== entry.childIndex);
			return siblings.map((sibling) => sibling.pk!);
		});
		const { result } = signPrime({
			state: leafNode.round1State!,
			outs,
			sk: leafNode.sk!,
			m,
			cosignerKeys
		});
		leafNode.partialSig = result.s;
		leafNode.R = result.R;
	}
}

function round2Agg(node: TestNode): Signature {
	if (isLeaf(node)) {
		return { R: node.R!, s: node.partialSig! };
	}
	const childSigs = node.children.map((child) => round2Agg(child));
	const R = childSigs[0].R;
	for (let i = 1; i < childSigs.length; i++) {
		if (!childSigs[i].R.equals(R)) {
			throw new Error(`Mismatched effective nonce under ${node.id}`);
		}
	}
	const sigma = signAggPrime(
		childSigs.map((sig) => sig.s),
		R
	);
	node.partialSig = sigma.s;
	node.R = sigma.R;
	return sigma;
}

function runProtocol(root: AggNode, message: string): { Xtilde: Point; sigma: Signature } {
	keyGenTree(root);
	round1Tree(root);
	round2Leaves(root, encoder.encode(message));
	const sigma = round2Agg(root);
	return { Xtilde: root.pk!, sigma };
}

function singleNestingTree(): AggNode {
	return agg('root', [leaf('a'), agg('group-b', [leaf('b1'), leaf('b2')])]);
}

function doubleNestingTree(): AggNode {
	return agg('root', [
		leaf('a'),
		agg('group-b', [leaf('b1'), agg('group-c', [leaf('c1'), leaf('c2')])])
	]);
}

function mixedDepthTree(): AggNode {
	return agg('root', [
		leaf('a'),
		agg('group-b', [leaf('b1'), leaf('b2')]),
		agg('group-c', [agg('group-d', [leaf('d1'), leaf('d2')]), leaf('c1')])
	]);
}

describe('nested protocol correctness', () => {
	it('Single nesting (Λ=1 style topology) verifies', () => {
		const tree = singleNestingTree();
		const msg = 'single-nesting';
		const { Xtilde, sigma } = runProtocol(tree, msg);
		expect(verify(Xtilde, encoder.encode(msg), sigma)).toBe(true);
	});

	it('Double nesting (Λ=2 style topology) verifies', () => {
		const tree = doubleNestingTree();
		const msg = 'double-nesting';
		const { Xtilde, sigma } = runProtocol(tree, msg);
		expect(verify(Xtilde, encoder.encode(msg), sigma)).toBe(true);
	});

	it('Mixed-depth tree verifies', () => {
		const tree = mixedDepthTree();
		const msg = 'mixed-depth';
		const { Xtilde, sigma } = runProtocol(tree, msg);
		expect(verify(Xtilde, encoder.encode(msg), sigma)).toBe(true);
	});

	it('Correctness property over multiple trees: Ver(KeyAgg(L0), m, σ) = true', () => {
		const builders = [singleNestingTree, doubleNestingTree, mixedDepthTree];
		for (const [idx, build] of builders.entries()) {
			const tree = build();
			const msg = `property-message-${idx}`;
			const encoded = encoder.encode(msg);
			const { Xtilde, sigma } = runProtocol(tree, msg);
			expect(verify(Xtilde, encoded, sigma)).toBe(true);
		}
	});
});
