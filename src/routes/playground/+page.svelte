<script lang="ts">
	import CosignerFlow from '$lib/components/flow/CosignerFlow.svelte';
	import HexValue from '$lib/components/ui/HexValue.svelte';
	import KaTeX from '$lib/components/ui/KaTeX.svelte';
	import { bytesToHex, serializePoint, serializeScalar } from '$lib/crypto/utils';
	import { verify } from '$lib/crypto/verify';
	import {
		computeDepths,
		createAggregator,
		createLeaf,
		keyGenTree,
		round1Tree,
		round2Tree
	} from '$lib/tree/operations';
	import type { CosignerTree, TreeNode } from '$lib/tree/types';
	import type { Phase } from '$lib/stores/animation';

	const encoder = new TextEncoder();

	function maxDepth(node: TreeNode): number {
		if (node.role === 'leaf' || !node.children || node.children.length === 0) {
			return node.depth ?? 0;
		}
		return Math.max(...node.children.map((child) => maxDepth(child)));
	}

	function buildDemoTree(): CosignerTree {
		const alice = createLeaf('alice', 'Alice');
		const bob = createLeaf('bob', 'Bob');
		const carol = createLeaf('carol', 'Carol');
		const dave = createLeaf('dave', 'Dave');

		const groupB = createAggregator('group-b', [bob, carol], 'Group B');
		const groupC = createAggregator('group-c', [dave], 'Group C');
		const root = createAggregator('root', [alice, groupB, groupC], 'Root');

		computeDepths(root);
		return {
			root,
			maxDepth: maxDepth(root)
		};
	}

	let tree = $state<CosignerTree>(buildDemoTree());
	let phase = $state<Phase>('idle');
	let selectedNode = $state<TreeNode | null>(null);
	let message = $state('Hello, NestedMuSig2!');
	let verifyResult = $state<boolean | null>(null);
	let status = $state('Build tree and step through the protocol.');
	const verificationEquation = 'g^s = R \\cdot \\tilde{X}^c';

	const messageBytes = $derived(encoder.encode(message));
	const hasKeys = $derived(Boolean(tree.root.pk));
	const hasRound1 = $derived(Boolean(tree.root.round1Out));
	const hasSignature = $derived(Boolean(tree.root.signature));
	const signatureRHex = $derived(
		tree.root.signature ? bytesToHex(serializePoint(tree.root.signature.R)) : ''
	);
	const signatureSHex = $derived(
		tree.root.signature ? bytesToHex(serializeScalar(tree.root.signature.s)) : ''
	);

	function refreshTree() {
		tree = { ...tree, root: tree.root };
	}

	function resetDemo() {
		tree = buildDemoTree();
		phase = 'idle';
		selectedNode = null;
		verifyResult = null;
		status = 'Build tree and step through the protocol.';
	}

	function runKeyGen() {
		keyGenTree(tree.root);
		phase = 'keygen';
		verifyResult = null;
		status = 'Key generation complete.';
		refreshTree();
	}

	function runRound1() {
		if (!hasKeys) {
			runKeyGen();
		}
		round1Tree(tree.root);
		phase = 'round1';
		verifyResult = null;
		status = 'Round 1 nonce commitments complete.';
		refreshTree();
	}

	function runRound2() {
		if (hasSignature) {
			phase = 'round2';
			status = 'Round 2 already complete for this tree state.';
			refreshTree();
			return;
		}
		if (!hasRound1) {
			runRound1();
		}
		const sigma = round2Tree(tree.root, messageBytes);
		phase = 'round2';
		verifyResult = tree.root.pk ? verify(tree.root.pk, messageBytes, sigma) : null;
		status = 'Round 2 signing complete.';
		refreshTree();
	}

	function runVerify() {
		if (!hasSignature) {
			runRound2();
		}
		phase = 'verify';
		verifyResult =
			tree.root.pk && tree.root.signature ? verify(tree.root.pk, messageBytes, tree.root.signature) : null;
		status = verifyResult ? 'Verification accepted.' : 'Verification failed.';
		refreshTree();
	}
</script>

<section class="space-y-5">
	<div class="space-y-2">
		<p class="text-xs uppercase tracking-[0.2em] text-zinc-400">Interactive Playground</p>
		<h1 class="text-2xl font-semibold text-zinc-100">NestedMuSig2 Phase 4 Visualization</h1>
		<p class="text-zinc-300">{status}</p>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-900"
			onclick={runKeyGen}>Generate Keys</button
		>
		<button
			type="button"
			class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-900"
			onclick={runRound1}>Round 1</button
		>
		<button
			type="button"
			class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-900"
			onclick={runRound2}>Round 2</button
		>
		<button
			type="button"
			class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-900"
			onclick={runVerify}>Verify</button
		>
		<button
			type="button"
			class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-900"
			onclick={resetDemo}>Reset</button
		>
	</div>

	<label class="block space-y-1">
		<span class="text-xs uppercase tracking-wide text-zinc-400">Message</span>
		<input
			class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
			bind:value={message}
			placeholder="Message to sign"
		/>
	</label>

	<CosignerFlow
		{tree}
		currentPhase={phase}
		onNodeSelect={(node) => {
			selectedNode = node;
		}}
	/>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Selection</h2>
			{#if selectedNode}
				<p class="mb-2 text-sm font-semibold">{selectedNode.label ?? selectedNode.id}</p>
				{#if selectedNode.pk}
					<HexValue value={bytesToHex(serializePoint(selectedNode.pk))} label="pk" />
				{/if}
				{#if selectedNode.partialSig !== undefined}
					<div class="mt-2">
						<HexValue value={bytesToHex(serializeScalar(selectedNode.partialSig))} label="partial s" />
					</div>
				{/if}
			{:else}
				<p class="text-sm text-zinc-400">Select a node in the flow to inspect values.</p>
			{/if}
		</div>

		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Verification</h2>
			<KaTeX math={verificationEquation} displayMode />
			{#if signatureRHex && signatureSHex}
				<div class="mt-2 flex flex-col gap-1">
					<HexValue value={signatureRHex} label="R" />
					<HexValue value={signatureSHex} label="s" />
				</div>
			{/if}
			{#if verifyResult !== null}
				<p class={['mt-3 text-sm font-semibold', verifyResult ? 'text-emerald-300' : 'text-rose-300']}>
					{verifyResult ? 'Valid signature' : 'Invalid signature'}
				</p>
			{/if}
		</div>
	</div>
</section>
