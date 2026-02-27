<script lang="ts">
	import HexValue from '$lib/components/ui/HexValue.svelte';
	import KaTeX from '$lib/components/ui/KaTeX.svelte';
	import { H_sig } from '$lib/crypto/hash';
	import { bytesToHex, serializePoint, serializeScalar } from '$lib/crypto/utils';
	import { verify } from '$lib/crypto/verify';
	import { computeDepths, createAggregator, createLeaf, keyGenTree, round1Tree, round2Tree } from '$lib/tree/operations';
	import type { TreeNode } from '$lib/tree/types';

	type RootNode = TreeNode & { role: 'aggregator'; children: TreeNode[] };

	const message = new TextEncoder().encode('NestedMuSig2 verify demo');
	let root = $state<RootNode | null>(null);
	let tamperedS = $state('');
	let tamperedValid = $state<boolean | null>(null);

	const aggregateKeyHex = $derived(root?.pk ? bytesToHex(serializePoint(root.pk)) : '');
	const rHex = $derived(root?.signature ? bytesToHex(serializePoint(root.signature.R)) : '');
	const sHex = $derived(root?.signature ? bytesToHex(serializeScalar(root.signature.s)) : '');
	const cHex = $derived.by(() => {
		if (!root?.pk || !root.signature) {
			return '';
		}
		return bytesToHex(serializeScalar(H_sig(root.pk, root.signature.R, message)));
	});
	const valid = $derived.by(() => {
		if (!root?.pk || !root.signature) {
			return null;
		}
		return verify(root.pk, message, root.signature);
	});

	function newSignature(): void {
		const nextRoot = createAggregator(
			'root',
			[createLeaf('alice', 'Alice'), createLeaf('bob', 'Bob')],
			'Root'
		) as RootNode;
		computeDepths(nextRoot);
		keyGenTree(nextRoot);
		round1Tree(nextRoot);
		round2Tree(nextRoot, message);
		root = nextRoot;
		tamperedS = '';
		tamperedValid = null;
	}

	function tamper(): void {
		if (!root?.pk || !root.signature) {
			return;
		}
		const mutated = root.signature.s ^ 1n;
		tamperedS = bytesToHex(serializeScalar(mutated));
		tamperedValid = verify(root.pk, message, { R: root.signature.R, s: mutated });
	}

	newSignature();
</script>

<div class="not-prose space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
	<div class="flex items-center justify-between gap-2">
		<h3 class="text-sm font-semibold text-stone-900">Verification Demo</h3>
		<div class="flex gap-2">
			<button
				type="button"
				class="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
				onclick={newSignature}>New Signature</button
			>
			<button
				type="button"
				class="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
				onclick={tamper}>Tamper</button
			>
		</div>
	</div>

	<KaTeX math={'g^s = R \\cdot \\tilde{X}^c'} displayMode />

	<div class="grid gap-2">
		{#if aggregateKeyHex}<HexValue value={aggregateKeyHex} label="X~" />{/if}
		{#if cHex}<HexValue value={cHex} label="c" />{/if}
		{#if rHex}<HexValue value={rHex} label="R" />{/if}
		{#if sHex}<HexValue value={sHex} label="s" />{/if}
	</div>

	{#if valid !== null}
		<p class={['text-sm font-semibold', valid ? 'text-emerald-600' : 'text-rose-600']}>
			Original signature: {valid ? 'Valid' : 'Invalid'}
		</p>
	{/if}

	{#if tamperedS}
		<div class="space-y-2 rounded-md border border-stone-200 bg-white p-3">
			<HexValue value={tamperedS} label="tampered s" />
			{#if tamperedValid !== null}
				<p class={['text-sm font-semibold', tamperedValid ? 'text-amber-600' : 'text-rose-600']}>
					Tampered signature: {tamperedValid ? 'Valid (unexpected)' : 'Invalid (expected)'}
				</p>
			{/if}
		</div>
	{/if}
</div>
