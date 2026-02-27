<script lang="ts">
	import HexValue from '$lib/components/ui/HexValue.svelte';
	import KaTeX from '$lib/components/ui/KaTeX.svelte';
	import { bytesToHex, serializePoint, serializeScalar, type Point } from '$lib/crypto/utils';
	import { computeDepths, createAggregator, createLeaf, keyGenTree, round1Tree } from '$lib/tree/operations';
	import type { TreeNode } from '$lib/tree/types';

	type RootNode = TreeNode & { role: 'aggregator'; children: TreeNode[] };

	let root = $state<RootNode | null>(null);

	const leftLeaf = $derived.by(() => (root?.children[0] ? root.children[0] : null));
	const rightLeaf = $derived.by(() => (root?.children[1] ? root.children[1] : null));

	function pointHex(point: Point): string {
		return bytesToHex(serializePoint(point));
	}

	function scalarHex(value: bigint): string {
		return bytesToHex(serializeScalar(value));
	}

	function regenerate(): void {
		const nextRoot = createAggregator(
			'root',
			[createLeaf('alice', 'Alice'), createLeaf('bob', 'Bob')],
			'Root'
		) as RootNode;
		computeDepths(nextRoot);
		keyGenTree(nextRoot);
		round1Tree(nextRoot);
		root = nextRoot;
	}

	regenerate();
</script>

<div class="not-prose space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
	<div class="flex items-center justify-between gap-3">
		<h3 class="text-sm font-semibold text-stone-900">Round 1 Demo</h3>
		<button
			type="button"
			class="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
			onclick={regenerate}>Regenerate</button
		>
	</div>

	<KaTeX math={"R'_j = \\prod R_{i,j},\\ R_j = (R'_j)^{b^{j-1}}"} displayMode />

	<div class="grid gap-3 md:grid-cols-2">
		{#if leftLeaf?.round1Out}
			<div class="rounded-md border border-stone-200 bg-white p-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Alice commitments</p>
				{#each leftLeaf.round1Out.nonces as nonce, index}
					<HexValue value={pointHex(nonce)} label={`R${index + 1}`} />
				{/each}
			</div>
		{/if}
		{#if rightLeaf?.round1Out}
			<div class="rounded-md border border-stone-200 bg-white p-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Bob commitments</p>
				{#each rightLeaf.round1Out.nonces as nonce, index}
					<HexValue value={pointHex(nonce)} label={`R${index + 1}`} />
				{/each}
			</div>
		{/if}
	</div>

	{#if root?.internalAgg && root.round1Out}
		<div class="grid gap-3 md:grid-cols-2">
			<div class="rounded-md border border-amber-300 bg-amber-50 p-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Internal aggregate (SignAgg)</p>
				{#each root.internalAgg as nonce, index}
					<HexValue value={pointHex(nonce)} label={`R'${index + 1}`} />
				{/each}
			</div>
			<div class="rounded-md border border-emerald-300 bg-emerald-50 p-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">External aggregate (SignAggExt)</p>
				{#if root.bindingValue !== undefined}
					<HexValue value={scalarHex(root.bindingValue)} label="b" />
				{/if}
				{#each root.round1Out.nonces as nonce, index}
					<HexValue value={pointHex(nonce)} label={`R${index + 1}`} />
				{/each}
			</div>
		</div>
	{/if}
</div>
