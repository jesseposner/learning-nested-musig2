import type { Point } from '$lib/crypto/utils';
import type { Round1Output, Round1State } from '$lib/crypto/sign';
import type { Signature } from '$lib/crypto/agg-prime';

export type NodeRole = 'leaf' | 'aggregator';

export interface TreeNode {
	id: string;
	role: NodeRole;
	children?: TreeNode[];
	sk?: bigint;
	pk?: Point;
	keyList?: Point[];
	aggCoef?: bigint;
	round1Out?: Round1Output;
	round1State?: Round1State;
	internalAgg?: Point[];
	bindingValue?: bigint;
	partialSig?: bigint;
	effectiveNonce?: Point;
	signature?: Signature;
	label?: string;
	depth?: number;
}

export interface CosignerTree {
	root: TreeNode;
	maxDepth: number;
}
