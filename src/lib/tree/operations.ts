import { keyAgg, keyAggCoef, keyGen } from '$lib/crypto/keygen';
import { sign, type Round1Output } from '$lib/crypto/sign';
import { signAgg, signAggExt } from '$lib/crypto/agg';
import { signPrime, type SignPrimeInput } from '$lib/crypto/sign-prime';
import { signAggPrime, type Signature } from '$lib/crypto/agg-prime';
import type { Point } from '$lib/crypto/utils';
import type { TreeNode } from './types';

type PathEntry = {
	node: TreeNode;
	childIndex: number;
};

export type SignPrimeCollectedInputs = Pick<SignPrimeInput, 'outs' | 'cosignerKeys'>;

function assertAggregator(node: TreeNode): asserts node is TreeNode & { role: 'aggregator'; children: TreeNode[] } {
	if (node.role !== 'aggregator') {
		throw new Error(`Expected aggregator node, got leaf: ${node.id}`);
	}
	if (!node.children || node.children.length === 0) {
		throw new Error(`Aggregator node has no children: ${node.id}`);
	}
}

function requirePk(node: TreeNode): Point {
	if (!node.pk) {
		throw new Error(`Missing public key on node: ${node.id}`);
	}
	return node.pk;
}

function findLeafPath(node: TreeNode, leafId: string, path: PathEntry[] = []): { leaf: TreeNode; path: PathEntry[] } | null {
	if (node.role === 'leaf') {
		return node.id === leafId ? { leaf: node, path } : null;
	}

	assertAggregator(node);
	for (let childIndex = 0; childIndex < node.children.length; childIndex++) {
		const child = node.children[childIndex];
		const match = findLeafPath(child, leafId, [...path, { node, childIndex }]);
		if (match) {
			return match;
		}
	}

	return null;
}

function collectLeaves(node: TreeNode, leaves: TreeNode[] = []): TreeNode[] {
	if (node.role === 'leaf') {
		leaves.push(node);
		return leaves;
	}

	assertAggregator(node);
	for (const child of node.children) {
		collectLeaves(child, leaves);
	}
	return leaves;
}

function aggregateRound2(node: TreeNode): Signature {
	if (node.role === 'leaf') {
		if (!node.effectiveNonce || node.partialSig === undefined) {
			throw new Error(`Leaf node is missing round-2 output: ${node.id}`);
		}
		return { R: node.effectiveNonce, s: node.partialSig };
	}

	assertAggregator(node);
	const childSigs = node.children.map((child) => aggregateRound2(child));
	const R = childSigs[0].R;

	for (let i = 1; i < childSigs.length; i++) {
		if (!childSigs[i].R.equals(R)) {
			throw new Error(`Children produced different effective nonces under: ${node.id}`);
		}
	}

	const sigma = signAggPrime(
		childSigs.map((sig) => sig.s),
		R
	);
	node.partialSig = sigma.s;
	node.effectiveNonce = sigma.R;
	return sigma;
}

export function createLeaf(id: string, label?: string): TreeNode {
	const { sk, pk } = keyGen();
	return {
		id,
		role: 'leaf',
		label,
		sk,
		pk
	};
}

export function createAggregator(id: string, children: TreeNode[], label?: string): TreeNode {
	return {
		id,
		role: 'aggregator',
		children,
		label
	};
}

export function computeDepths(node: TreeNode, depth = 0): void {
	node.depth = depth;
	if (node.role === 'leaf') {
		return;
	}

	assertAggregator(node);
	for (const child of node.children) {
		computeDepths(child, depth + 1);
	}
}

export function keyGenTree(node: TreeNode): void {
	if (node.role === 'leaf') {
		const { sk, pk } = keyGen();
		node.sk = sk;
		node.pk = pk;
		return;
	}

	assertAggregator(node);
	for (const child of node.children) {
		keyGenTree(child);
	}

	const childPks = node.children.map((child) => requirePk(child));
	node.keyList = childPks;
	node.pk = keyAgg(childPks);

	for (const child of node.children) {
		child.aggCoef = keyAggCoef(childPks, requirePk(child));
	}
}

export function round1Tree(node: TreeNode): void {
	if (node.role === 'leaf') {
		const { out, state } = sign();
		node.round1Out = out;
		node.round1State = state;
		return;
	}

	assertAggregator(node);
	for (const child of node.children) {
		round1Tree(child);
	}

	const childOuts: Round1Output[] = node.children.map((child) => {
		if (!child.round1Out) {
			throw new Error(`Missing round-1 output on child: ${child.id}`);
		}
		return child.round1Out;
	});

	const internalAgg = signAgg(childOuts);
	const { bound, b } = signAggExt(internalAgg, requirePk(node));
	node.internalAgg = internalAgg;
	node.bindingValue = b;
	node.round1Out = { nonces: bound };
}

export function collectSignPrimeInputs(root: TreeNode, leafId: string): SignPrimeCollectedInputs {
	const match = findLeafPath(root, leafId);
	if (!match) {
		throw new Error(`Leaf not found: ${leafId}`);
	}

	if (match.path.length === 0) {
		throw new Error(`Leaf has no aggregator ancestors and cannot produce out^0: ${leafId}`);
	}

	const outs: Point[][] = [];
	const cosignerKeys: Point[][] = [];

	for (const { node, childIndex } of match.path) {
		assertAggregator(node);
		if (!node.internalAgg) {
			throw new Error(`Missing internal aggregate at node: ${node.id}`);
		}

		outs.push(node.internalAgg);

		const siblingKeys = node.children
			.filter((_, index) => index !== childIndex)
			.map((sibling) => requirePk(sibling));
		cosignerKeys.push(siblingKeys);
	}

	return { outs, cosignerKeys };
}

export function round2Tree(root: TreeNode, m: Uint8Array): Signature {
	const leaves = collectLeaves(root);

	for (const leaf of leaves) {
		if (leaf.role !== 'leaf') {
			throw new Error(`Expected leaf node, got: ${leaf.id}`);
		}
		if (!leaf.round1State) {
			throw new Error(`Missing round-1 state on leaf: ${leaf.id}`);
		}
		if (leaf.sk === undefined) {
			throw new Error(`Missing secret key on leaf: ${leaf.id}`);
		}

		const { outs, cosignerKeys } = collectSignPrimeInputs(root, leaf.id);
		const { result } = signPrime({
			state: leaf.round1State,
			outs,
			sk: leaf.sk,
			m,
			cosignerKeys
		});

		leaf.partialSig = result.s;
		leaf.effectiveNonce = result.R;

		// Round-1 secret state is one-time use and should be removed after signing.
		leaf.round1State = undefined;
	}

	const sigma = aggregateRound2(root);
	root.signature = sigma;
	return sigma;
}
