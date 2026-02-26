import { describe, expect, it } from 'vitest';
import { keyAgg, keyAggCoef } from '$lib/crypto/keygen';
import { verify } from '$lib/crypto/verify';
import { NU, type Point } from '$lib/crypto/utils';
import type { TreeNode } from '../types';
import {
	collectSignPrimeInputs,
	computeDepths,
	createAggregator,
	createLeaf,
	keyGenTree,
	round1Tree,
	round2Tree
} from '../operations';

const encoder = new TextEncoder();

function walk(node: TreeNode, fn: (node: TreeNode) => void): void {
	fn(node);
	if (node.role === 'aggregator' && node.children) {
		for (const child of node.children) {
			walk(child, fn);
		}
	}
}

function pointSetEquals(a: Point[], b: Point[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return a.every((left) => b.some((right) => left.equals(right)));
}

function buildSingleNestingTree(): TreeNode {
	const a = createLeaf('a');
	const b1 = createLeaf('b1');
	const b2 = createLeaf('b2');
	const groupB = createAggregator('group-b', [b1, b2]);
	return createAggregator('root', [a, groupB]);
}

function buildDoubleNestingTree(): TreeNode {
	const a = createLeaf('a');
	const b1 = createLeaf('b1');
	const c1 = createLeaf('c1');
	const c2 = createLeaf('c2');
	const groupC = createAggregator('group-c', [c1, c2]);
	const groupB = createAggregator('group-b', [b1, groupC]);
	return createAggregator('root', [a, groupB]);
}

function buildMixedDepthTree(): {
	root: TreeNode;
	nodes: Record<string, TreeNode>;
} {
	const a = createLeaf('a');
	const b1 = createLeaf('b1');
	const b2 = createLeaf('b2');
	const c1 = createLeaf('c1');
	const d1 = createLeaf('d1');
	const d2 = createLeaf('d2');

	const groupB = createAggregator('group-b', [b1, b2]);
	const groupD = createAggregator('group-d', [d1, d2]);
	const groupC = createAggregator('group-c', [groupD, c1]);
	const root = createAggregator('root', [a, groupB, groupC]);

	return {
		root,
		nodes: { root, a, groupB, b1, b2, groupC, c1, groupD, d1, d2 }
	};
}

describe('tree operations (Phase 3)', () => {
	it('constructs trees and computes depths', () => {
		const tree = buildDoubleNestingTree();
		computeDepths(tree);

		const depthById = new Map<string, number>();
		walk(tree, (node) => {
			depthById.set(node.id, node.depth ?? -1);
		});

		expect(depthById.get('root')).toBe(0);
		expect(depthById.get('a')).toBe(1);
		expect(depthById.get('group-b')).toBe(1);
		expect(depthById.get('b1')).toBe(2);
		expect(depthById.get('group-c')).toBe(2);
		expect(depthById.get('c1')).toBe(3);
		expect(depthById.get('c2')).toBe(3);
	});

	it("keyGenTree assigns keys bottom-up and stores each child's agg coefficient", () => {
		const { root } = buildMixedDepthTree();
		keyGenTree(root);

		walk(root, (node) => {
			expect(node.pk).toBeDefined();
			if (node.role === 'leaf') {
				expect(node.sk).toBeDefined();
				return;
			}

			expect(node.children).toBeDefined();
			expect(node.children!.length).toBeGreaterThan(0);
			expect(node.keyList).toBeDefined();
			expect(node.keyList!.length).toBe(node.children!.length);

			const expectedPk = keyAgg(node.children!.map((child) => child.pk!));
			expect(node.pk!.equals(expectedPk)).toBe(true);

			for (const child of node.children!) {
				expect(child.aggCoef).toBeDefined();
				expect(child.aggCoef).toBe(keyAggCoef(node.keyList!, child.pk!));
			}
		});
	});

	it('round1Tree assigns leaf states and aggregator internal/external nonce aggregates', () => {
		const { root } = buildMixedDepthTree();
		keyGenTree(root);
		round1Tree(root);

		walk(root, (node) => {
			expect(node.round1Out).toBeDefined();
			expect(node.round1Out!.nonces).toHaveLength(NU);

			if (node.role === 'leaf') {
				expect(node.round1State).toBeDefined();
				expect(node.round1State!.secrets).toHaveLength(NU);
			} else {
				expect(node.internalAgg).toBeDefined();
				expect(node.internalAgg).toHaveLength(NU);
				expect(node.bindingValue).toBeDefined();
			}
		});
	});

	it('collectSignPrimeInputs returns internal aggregates and correct sibling cosigner keys', () => {
		const { root, nodes } = buildMixedDepthTree();
		keyGenTree(root);
		round1Tree(root);

		const inputs = collectSignPrimeInputs(root, 'd1');
		expect(inputs.outs).toHaveLength(3);
		expect(inputs.cosignerKeys).toHaveLength(3);

		expect(inputs.outs[0]).toBe(nodes.root.internalAgg);
		expect(inputs.outs[1]).toBe(nodes.groupC.internalAgg);
		expect(inputs.outs[2]).toBe(nodes.groupD.internalAgg);

		expect(inputs.outs[0]).not.toBe(nodes.root.round1Out?.nonces);
		expect(inputs.outs[1]).not.toBe(nodes.groupC.round1Out?.nonces);
		expect(inputs.outs[2]).not.toBe(nodes.groupD.round1Out?.nonces);

		expect(pointSetEquals(inputs.cosignerKeys[0], [nodes.a.pk!, nodes.groupB.pk!])).toBe(true);
		expect(pointSetEquals(inputs.cosignerKeys[1], [nodes.c1.pk!])).toBe(true);
		expect(pointSetEquals(inputs.cosignerKeys[2], [nodes.d2.pk!])).toBe(true);
	});

	it('round2Tree signs and verifies across single, double, and mixed-depth trees', () => {
		const shapes: Array<{ name: string; make: () => TreeNode }> = [
			{ name: 'single', make: buildSingleNestingTree },
			{ name: 'double', make: buildDoubleNestingTree },
			{ name: 'mixed', make: () => buildMixedDepthTree().root }
		];

		for (const { name, make } of shapes) {
			const root = make();
			const msg = encoder.encode(`tree-ops-${name}`);

			computeDepths(root);
			keyGenTree(root);
			round1Tree(root);
			const sigma = round2Tree(root, msg);

			expect(root.pk).toBeDefined();
			expect(root.signature).toBeDefined();
			expect(root.signature!.R.equals(sigma.R)).toBe(true);
			expect(root.signature!.s).toBe(sigma.s);
			expect(verify(root.pk!, msg, sigma)).toBe(true);

			walk(root, (node) => {
				if (node.role === 'leaf') {
					expect(node.round1State).toBeUndefined();
					expect(node.partialSig).toBeDefined();
					expect(node.effectiveNonce).toBeDefined();
				}
			});
		}
	});
});
