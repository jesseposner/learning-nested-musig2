<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { bytesToHex, serializePoint, serializeScalar } from '$lib/crypto/utils';
	import type { TreeNode } from '$lib/tree/types';
	import type { Phase } from '$lib/stores/animation';
	import HexValue from '$lib/components/ui/HexValue.svelte';

	type SignerNodeData = {
		treeNode: TreeNode;
		currentPhase: Phase;
		registerElement?: (id: string, element: HTMLElement | null, depth: number) => void;
		onLabelChange?: (id: string, label: string) => void;
	};

	let { id, data, selected }: NodeProps = $props();

	let element = $state.raw<HTMLElement | null>(null);
	let labelInput = $state.raw<HTMLInputElement | null>(null);
	let editingLabel = $state(false);
	let draftLabel = $state('');
	const nodeData = $derived(data as SignerNodeData);
	const node = $derived(nodeData.treeNode);

	const pkHex = $derived(node.pk ? bytesToHex(serializePoint(node.pk)) : '');
	const nonceHexes = $derived(
		node.round1Out ? node.round1Out.nonces.map((nonce) => bytesToHex(serializePoint(nonce))) : []
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
			return 'border-emerald-600/60 bg-emerald-50 text-emerald-700';
		}
		if (current) {
			return 'border-indigo-500/60 bg-indigo-50 text-indigo-600';
		}
		return 'border-stone-300 bg-stone-50 text-stone-400';
	}

	function startLabelEdit(event: MouseEvent) {
		event.stopPropagation();
		draftLabel = node.label ?? node.id;
		editingLabel = true;
	}

	function commitLabel(event?: Event) {
		event?.stopPropagation();
		const next = draftLabel.trim();
		if (next.length > 0 && next !== (node.label ?? node.id)) {
			nodeData.onLabelChange?.(id, next);
		}
		editingLabel = false;
	}

	function cancelLabel(event?: Event) {
		event?.stopPropagation();
		editingLabel = false;
	}

	function handleLabelKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitLabel(event);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelLabel(event);
		}
	}

	$effect(() => {
		nodeData.registerElement?.(id, element, node.depth ?? 0);
		return () => {
			nodeData.registerElement?.(id, null, node.depth ?? 0);
		};
	});

	$effect(() => {
		if (editingLabel) {
			labelInput?.focus();
			labelInput?.select();
		}
	});
</script>

<div
	bind:this={element}
	data-depth={node.depth ?? 0}
	class={[
		'nm-flow-node rounded-xl border bg-white p-3 text-stone-900 shadow-md transition-all',
		selected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-stone-300',
		isCurrent('round1') || isCurrent('round2') ? 'scale-[1.01]' : ''
	]}
>
	<Handle type="target" position={Position.Top} />

	{#if editingLabel}
		<input
			bind:this={labelInput}
			class="mb-2 w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm font-semibold text-stone-900"
			bind:value={draftLabel}
			onblur={commitLabel}
			onkeydown={handleLabelKeydown}
			onclick={(event) => event.stopPropagation()}
		/>
	{:else}
		<button
			type="button"
			class="mb-2 cursor-text text-left text-sm font-semibold underline-offset-2 hover:underline"
			ondblclick={startLabelEdit}
		>
			{node.label ?? node.id}
		</button>
	{/if}

	<div class="space-y-1.5">
		{#if pkHex}
			<div class="nm-node-value">
				<HexValue value={pkHex} label="pk" />
			</div>
		{/if}

		{#if nonceHexes.length > 0}
			<div class="nm-node-value flex flex-col gap-1">
				{#each nonceHexes as nonceHex, index}
					<HexValue value={nonceHex} label={`R${index + 1}`} />
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
</div>
