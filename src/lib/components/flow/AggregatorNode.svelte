<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { bytesToHex, serializePoint, serializeScalar } from '$lib/crypto/utils';
	import type { TreeNode } from '$lib/tree/types';
	import type { Phase } from '$lib/stores/animation';
	import HexValue from '$lib/components/ui/HexValue.svelte';

	type AggregatorNodeData = {
		treeNode: TreeNode;
		currentPhase: Phase;
		registerElement?: (id: string, element: HTMLElement | null, depth: number) => void;
	};

	let { id, data, selected }: NodeProps = $props();

	let element: HTMLElement | null = null;
	const nodeData = $derived(data as AggregatorNodeData);
	const node = $derived(nodeData.treeNode);

	const pkHex = $derived(node.pk ? bytesToHex(serializePoint(node.pk)) : '');
	const internalHexes = $derived(
		node.internalAgg ? node.internalAgg.map((point) => bytesToHex(serializePoint(point))) : []
	);
	const externalHexes = $derived(
		node.round1Out ? node.round1Out.nonces.map((point) => bytesToHex(serializePoint(point))) : []
	);
	const bindingHex = $derived(
		node.bindingValue !== undefined ? bytesToHex(serializeScalar(node.bindingValue)) : ''
	);
	const partialSigHex = $derived(
		node.partialSig !== undefined ? bytesToHex(serializeScalar(node.partialSig)) : ''
	);

	const keyDone = $derived(Boolean(node.pk));
	const round1Done = $derived(Boolean(node.round1Out));
	const round2Done = $derived(node.partialSig !== undefined);

	function isCurrent(stage: 'keygen' | 'round1' | 'round2'): boolean {
		if (stage === 'round2') {
			return nodeData.currentPhase === 'round2' || nodeData.currentPhase === 'verify';
		}
		return nodeData.currentPhase === stage;
	}

	function stageClass(done: boolean, current: boolean): string {
		if (done) {
			return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200';
		}
		if (current) {
			return 'border-amber-500/60 bg-amber-500/10 text-amber-200';
		}
		return 'border-zinc-500/40 bg-zinc-900/40 text-zinc-400';
	}

	$effect(() => {
		nodeData.registerElement?.(id, element, node.depth ?? 0);
		return () => {
			nodeData.registerElement?.(id, null, node.depth ?? 0);
		};
	});
</script>

<div
	bind:this={element}
	data-depth={node.depth ?? 0}
	class={[
		'nm-flow-node rounded-xl border bg-zinc-900 p-3 text-zinc-100 shadow-xl transition-all',
		selected ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-zinc-700',
		isCurrent('round1') || isCurrent('round2') ? 'scale-[1.01]' : ''
	]}
>
	<Handle type="target" position={Position.Top} />

	<p class="mb-2 text-sm font-semibold">{node.label ?? node.id}</p>

	<div class="space-y-1.5">
		{#if pkHex}
			<div class="nm-node-value">
				<HexValue value={pkHex} label="X~" />
			</div>
		{/if}

		{#if internalHexes.length > 0}
			<div class="nm-node-value flex flex-col gap-1">
				{#each internalHexes as internalHex, index}
					<HexValue value={internalHex} label={`R'${index + 1}`} />
				{/each}
			</div>
		{/if}

		{#if bindingHex}
			<div class="nm-node-value">
				<HexValue value={bindingHex} label="b" />
			</div>
		{/if}

		{#if externalHexes.length > 0}
			<div class="nm-node-value flex flex-col gap-1">
				{#each externalHexes as externalHex, index}
					<HexValue value={externalHex} label={`R${index + 1}`} />
				{/each}
			</div>
		{/if}

		{#if partialSigHex}
			<div class="nm-node-value">
				<HexValue value={partialSigHex} label="s" />
			</div>
		{/if}
	</div>

	<div class="mt-3 flex gap-1 text-[10px] font-semibold uppercase tracking-wide">
		<span class={['rounded border px-1.5 py-0.5', stageClass(keyDone, isCurrent('keygen'))]}>key</span>
		<span class={['rounded border px-1.5 py-0.5', stageClass(round1Done, isCurrent('round1'))]}>r1</span>
		<span class={['rounded border px-1.5 py-0.5', stageClass(round2Done, isCurrent('round2'))]}>r2</span>
	</div>

	<Handle type="source" position={Position.Bottom} />
</div>
