<script lang="ts">
	import CosignerFlow from '$lib/components/flow/CosignerFlow.svelte';
	import HexValue from '$lib/components/ui/HexValue.svelte';
	import KaTeX from '$lib/components/ui/KaTeX.svelte';
	import { H_sig } from '$lib/crypto/hash';
	import { bytesToHex, serializePoint, serializeScalar, type Point } from '$lib/crypto/utils';
	import { verify } from '$lib/crypto/verify';
	import {
		computeDepths,
		createAggregator,
		keyGenTree,
		round1Tree,
		round2Tree
	} from '$lib/tree/operations';
	import type { TreeNode, CosignerTree } from '$lib/tree/types';
	import type { Phase } from '$lib/stores/animation';

	type PresetKey = 'simple' | 'nested' | 'deep' | 'complex' | 'custom';
	type ParentMatch = { parent: TreeNode; index: number };
	type Explanation = { title: string; text: string; formula?: string };

	const encoder = new TextEncoder();

	const steps: Array<{ id: Phase; label: string }> = [
		{ id: 'idle', label: 'Build Tree' },
		{ id: 'keygen', label: 'Key Gen' },
		{ id: 'round1', label: 'Round 1' },
		{ id: 'round2', label: 'Round 2' },
		{ id: 'verify', label: 'Verify' }
	];

	const explanations: Record<Phase, Explanation> = {
		idle: {
			title: 'Build Tree',
			text: 'Build your cosigner tree, then step through the NestedMuSig2 protocol. Add signers and groups to change the nesting depth and observe how intermediate values evolve.'
		},
		keygen: {
			title: 'KeyGen + KeyAgg',
			text: 'Each leaf generates a keypair, and every aggregator computes its weighted aggregate key bottom-up. These aggregate keys become the effective public keys seen by the parent level.',
			formula: '\\tilde{X} = \\prod_{i=1}^{n} X_i^{a_i},\\quad a_i = H_{\\text{agg}}(L, X_i)'
		},
		round1: {
			title: 'Sign + SignAgg + SignAggExt',
			text: 'Leaves create random nonce commitments. Aggregators combine child nonces coordinate-wise into internal aggregates, then apply nonce binding with b to produce bound external nonces.',
			formula: "b = H_{\\text{non}}(\\tilde{X}, R'_1, \\ldots, R'_\\nu),\\quad R_j = (R'_j)^{b^{j-1}}"
		},
		round2: {
			title: "Sign' + SignAgg'",
			text: 'Each leaf computes a partial signature with cascaded challenge and binding values across nesting levels. Aggregators sum child partial signatures to propagate a single signature scalar upward.',
			formula:
				's_1 = \\check{c}\\cdot sk + \\sum_{j=1}^{\\nu} r_j \\cdot \\check{b}^{j-1},\\quad \\check{c}=c\\prod a_{1,\\ell},\\;\\check{b}=\\prod b_\\ell'
		},
		verify: {
			title: 'Verification',
			text: 'Verification is standard Schnorr and depends only on aggregate key, message, and signature. The verifier cannot distinguish whether the signer set was flat or nested.',
			formula: 'g^s = R \\cdot \\tilde{X}^c,\\quad c = H_{\\text{sig}}(\\tilde{X}, R, m)'
		}
	};

	function createDraftLeaf(id: string, label: string): TreeNode {
		return {
			id,
			role: 'leaf',
			label
		};
	}

	function createDraftAggregator(id: string, children: TreeNode[], label: string): TreeNode {
		const node = createAggregator(id, children, label);
		return {
			...node,
			children
		};
	}

	function maxDepth(node: TreeNode): number {
		if (node.role === 'leaf' || !node.children || node.children.length === 0) {
			return node.depth ?? 0;
		}
		return Math.max(...node.children.map((child) => maxDepth(child)));
	}

	function treeFromRoot(root: TreeNode): CosignerTree {
		computeDepths(root);
		return {
			root,
			maxDepth: maxDepth(root)
		};
	}

	function findNode(node: TreeNode, targetId: string): TreeNode | null {
		if (node.id === targetId) {
			return node;
		}
		if (node.role === 'aggregator' && node.children) {
			for (const child of node.children) {
				const found = findNode(child, targetId);
				if (found) {
					return found;
				}
			}
		}
		return null;
	}

	function findParent(node: TreeNode, targetId: string): ParentMatch | null {
		if (node.role !== 'aggregator' || !node.children) {
			return null;
		}

		for (let index = 0; index < node.children.length; index++) {
			const child = node.children[index];
			if (child.id === targetId) {
				return { parent: node, index };
			}
			const nested = findParent(child, targetId);
			if (nested) {
				return nested;
			}
		}

		return null;
	}

	function clearCryptoState(node: TreeNode): void {
		node.sk = undefined;
		node.pk = undefined;
		node.keyList = undefined;
		node.aggCoef = undefined;
		node.round1Out = undefined;
		node.round1State = undefined;
		node.internalAgg = undefined;
		node.bindingValue = undefined;
		node.partialSig = undefined;
		node.effectiveNonce = undefined;
		node.signature = undefined;

		if (node.role === 'aggregator' && node.children) {
			for (const child of node.children) {
				clearCryptoState(child);
			}
		}
	}

	function pointHex(point: Point | undefined): string {
		return point ? bytesToHex(serializePoint(point)) : '';
	}

	function scalarHex(value: bigint | undefined): string {
		return value === undefined ? '' : bytesToHex(serializeScalar(value));
	}

	function buildPresetTree(preset: Exclude<PresetKey, 'custom'>): CosignerTree {
		switch (preset) {
			case 'simple': {
				const root = createDraftAggregator(
					'root',
					[createDraftLeaf('alice', 'Alice'), createDraftLeaf('bob', 'Bob')],
					'Root'
				);
				return treeFromRoot(root);
			}
			case 'nested': {
				const groupB = createDraftAggregator(
					'group-b',
					[createDraftLeaf('bob', 'Bob'), createDraftLeaf('carol', 'Carol')],
					'Group B'
				);
				const root = createDraftAggregator('root', [createDraftLeaf('alice', 'Alice'), groupB], 'Root');
				return treeFromRoot(root);
			}
			case 'deep': {
				const groupC = createDraftAggregator(
					'group-c',
					[createDraftLeaf('carol', 'Carol'), createDraftLeaf('dave', 'Dave')],
					'Group C'
				);
				const groupB = createDraftAggregator('group-b', [createDraftLeaf('bob', 'Bob'), groupC], 'Group B');
				const root = createDraftAggregator('root', [createDraftLeaf('alice', 'Alice'), groupB], 'Root');
				return treeFromRoot(root);
			}
			case 'complex': {
				const groupB = createDraftAggregator(
					'group-b',
					[createDraftLeaf('bob', 'Bob'), createDraftLeaf('carol', 'Carol')],
					'Group B'
				);
				const groupC = createDraftAggregator('group-c', [createDraftLeaf('dave', 'Dave')], 'Group C');
				const root = createDraftAggregator('root', [createDraftLeaf('alice', 'Alice'), groupB, groupC], 'Root');
				return treeFromRoot(root);
			}
		}
	}

	let signerCounter = $state(1);
	let groupCounter = $state(1);
	let nodeCounter = $state(1);

	function resetBuilderCounters(): void {
		signerCounter = 1;
		groupCounter = 1;
		nodeCounter = 1;
	}

	function nextId(prefix: string): string {
		const id = `${prefix}-${nodeCounter}`;
		nodeCounter += 1;
		return id;
	}

	function nextSignerLabel(): string {
		const label = `Signer ${signerCounter}`;
		signerCounter += 1;
		return label;
	}

	function nextGroupLabel(): string {
		const label = `Group ${groupCounter}`;
		groupCounter += 1;
		return label;
	}

	let tree = $state<CosignerTree>(buildPresetTree('complex'));
	let activePreset = $state<PresetKey>('complex');
	let phase = $state<Phase>('idle');
	let selectedNodeId = $state<string | null>(null);
	let message = $state('Hello, NestedMuSig2!');
	let info = $state('Use the tree builder, then run each protocol round.');
	let explanationsOpen = $state(true);
	let verificationResult = $state<boolean | null>(null);
	let tamperedResult = $state<boolean | null>(null);
	let tamperedSHex = $state('');

	const selectedNode = $derived.by(() => {
		if (!selectedNodeId) {
			return null;
		}
		return findNode(tree.root, selectedNodeId);
	});

	const selectedParent = $derived.by(() => {
		if (!selectedNodeId) {
			return null;
		}
		return findParent(tree.root, selectedNodeId);
	});

	const canRemoveSelected = $derived.by(() => {
		if (!selectedNode || selectedNode.id === tree.root.id || !selectedParent) {
			return false;
		}
		const siblings = selectedParent.parent.children;
		return Boolean(siblings && siblings.length > 1);
	});

	const selectedAggregator = $derived.by(() => {
		if (selectedNode && selectedNode.role === 'aggregator') {
			return selectedNode;
		}
		return tree.root;
	});

	const messageBytes = $derived(encoder.encode(message));
	const messageHex = $derived(bytesToHex(messageBytes));

	const hasKeys = $derived(Boolean(tree.root.pk));
	const hasRound1 = $derived(Boolean(tree.root.round1Out));
	const hasSignature = $derived(Boolean(tree.root.signature));

	const aggregateKeyHex = $derived(pointHex(tree.root.pk));
	const signatureRHex = $derived(tree.root.signature ? pointHex(tree.root.signature.R) : '');
	const signatureSHex = $derived(tree.root.signature ? scalarHex(tree.root.signature.s) : '');

	const challenge = $derived.by(() => {
		if (!tree.root.pk || !tree.root.signature) {
			return null;
		}
		return H_sig(tree.root.pk, tree.root.signature.R, messageBytes);
	});

	const challengeHex = $derived(challenge === null ? '' : scalarHex(challenge));

	const completedStepIndex = $derived.by(() => {
		if (verificationResult !== null) {
			return 4;
		}
		if (hasSignature) {
			return 3;
		}
		if (hasRound1) {
			return 2;
		}
		if (hasKeys) {
			return 1;
		}
		return 0;
	});

	const currentStepIndex = $derived(steps.findIndex((step) => step.id === phase));
	const currentExplanation = $derived(explanations[phase]);

	function refreshTree(): void {
		tree = { ...tree, root: tree.root, maxDepth: tree.maxDepth };
	}

	function syncSelection(preferred: string | null): void {
		selectedNodeId = preferred && findNode(tree.root, preferred) ? preferred : null;
	}

	function resetProtocolState(preferredSelection: string | null = selectedNodeId): void {
		clearCryptoState(tree.root);
		computeDepths(tree.root);
		tree.maxDepth = maxDepth(tree.root);
		phase = 'idle';
		verificationResult = null;
		tamperedResult = null;
		tamperedSHex = '';
		syncSelection(preferredSelection);
		refreshTree();
	}

	function loadPreset(preset: Exclude<PresetKey, 'custom'>): void {
		resetBuilderCounters();
		tree = buildPresetTree(preset);
		activePreset = preset;
		phase = 'idle';
		selectedNodeId = null;
		verificationResult = null;
		tamperedResult = null;
		tamperedSHex = '';
		info = `${steps[0].label}: loaded ${preset} preset.`;
	}

	function addSigner(): void {
		const target = selectedAggregator;
		if (target.role !== 'aggregator') {
			return;
		}
		target.children = target.children ?? [];
		target.children.push(createDraftLeaf(nextId('leaf'), nextSignerLabel()));
		activePreset = 'custom';
		info = `Added signer to ${target.label ?? target.id}.`;
		resetProtocolState(target.id);
	}

	function addGroup(): void {
		const target = selectedAggregator;
		if (target.role !== 'aggregator') {
			return;
		}
		target.children = target.children ?? [];

		const group = createDraftAggregator(
			nextId('group'),
			[
				createDraftLeaf(nextId('leaf'), nextSignerLabel()),
				createDraftLeaf(nextId('leaf'), nextSignerLabel())
			],
			nextGroupLabel()
		);

		target.children.push(group);
		activePreset = 'custom';
		info = `Added ${group.label ?? group.id} under ${target.label ?? target.id}.`;
		resetProtocolState(group.id);
	}

	function removeSelected(): void {
		if (!selectedNode || !canRemoveSelected || !selectedParent) {
			return;
		}

		const removedLabel = selectedNode.label ?? selectedNode.id;
		selectedParent.parent.children?.splice(selectedParent.index, 1);
		activePreset = 'custom';
		info = `Removed ${removedLabel}.`;
		resetProtocolState(selectedParent.parent.id);
	}

	function renameNode(id: string, label: string): void {
		const node = findNode(tree.root, id);
		if (!node) {
			return;
		}
		node.label = label;
		refreshTree();
	}

	function runKeyGen(): void {
		try {
			keyGenTree(tree.root);
			phase = 'keygen';
			verificationResult = null;
			tamperedResult = null;
			tamperedSHex = '';
			info = 'Key generation complete. Aggregation coefficients and aggregate keys are populated.';
			refreshTree();
		} catch (error) {
			info = `Key generation error: ${error instanceof Error ? error.message : 'unknown error'}`;
		}
	}

	function runRound1(): void {
		if (!hasKeys) {
			runKeyGen();
		}
		try {
			round1Tree(tree.root);
			phase = 'round1';
			verificationResult = null;
			tamperedResult = null;
			tamperedSHex = '';
			info = 'Round 1 complete. Internal and external nonce aggregates are available.';
			refreshTree();
		} catch (error) {
			info = `Round 1 error: ${error instanceof Error ? error.message : 'unknown error'}`;
		}
	}

	function runRound2(): void {
		if (!hasRound1) {
			runRound1();
		}
		if (hasSignature) {
			phase = 'round2';
			info = 'Round 2 already computed for this tree state.';
			refreshTree();
			return;
		}
		try {
			round2Tree(tree.root, messageBytes);
			phase = 'round2';
			verificationResult = null;
			tamperedResult = null;
			tamperedSHex = '';
			info = 'Round 2 complete. Partial signatures were aggregated to a final signature.';
			refreshTree();
		} catch (error) {
			info = `Round 2 error: ${error instanceof Error ? error.message : 'unknown error'}`;
		}
	}

	function runVerify(): void {
		if (!hasSignature) {
			runRound2();
		}

		if (tree.root.pk && tree.root.signature) {
			verificationResult = verify(tree.root.pk, messageBytes, tree.root.signature);
			phase = 'verify';
			info = verificationResult ? 'Verification accepted for the current message.' : 'Verification failed.';
			refreshTree();
		}
	}

	function tamperSignature(): void {
		if (!tree.root.pk || !tree.root.signature) {
			return;
		}

		const tamperedS = tree.root.signature.s ^ 1n;
		tamperedSHex = scalarHex(tamperedS);
		tamperedResult = verify(tree.root.pk, messageBytes, {
			R: tree.root.signature.R,
			s: tamperedS
		});

		if (verificationResult === null) {
			verificationResult = verify(tree.root.pk, messageBytes, tree.root.signature);
		}

		phase = 'verify';
		info = 'Tamper check computed with a single-bit flip in s.';
		refreshTree();
	}

	function resetAll(): void {
		resetProtocolState(selectedNodeId);
		info = 'Protocol state reset. Tree structure retained.';
	}

	function jumpToStep(stepIndex: number, stepPhase: Phase): void {
		if (stepIndex > completedStepIndex) {
			return;
		}
		if (stepPhase === 'verify' && verificationResult === null) {
			return;
		}
		phase = stepPhase;
		info = `Viewing ${steps[stepIndex].label}.`;
		refreshTree();
	}

	function stepClasses(index: number): string {
		if (index === currentStepIndex) {
			return 'border-sky-400 bg-sky-500/20 text-sky-100';
		}
		if (index <= completedStepIndex) {
			return 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100';
		}
		return 'border-zinc-700 bg-zinc-900 text-zinc-400';
	}
</script>

<section class="space-y-5">
	<div class="space-y-1">
		<p class="text-xs uppercase tracking-[0.2em] text-zinc-400">Interactive Playground</p>
		<h1 class="text-2xl font-semibold text-zinc-100">NestedMuSig2 Interactive Playground</h1>
		<p class="text-zinc-300">Build a cosigner tree and step through the signing protocol.</p>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-300">Tree Builder</h2>
			<p class="text-xs text-zinc-400">Target aggregator: {selectedAggregator.label ?? selectedAggregator.id}</p>
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			{#each [
				{ key: 'simple', label: 'Simple (2 signers)' },
				{ key: 'nested', label: 'Nested (2+2)' },
				{ key: 'deep', label: 'Deep (3 levels)' },
				{ key: 'complex', label: 'Complex (mixed)' }
			] as preset}
				<button
					type="button"
					class={[
						'rounded-md border px-3 py-1.5 text-xs font-semibold',
						activePreset === preset.key
							? 'border-emerald-500/70 bg-emerald-500/20 text-emerald-100'
							: 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'
					]}
					onclick={() => loadPreset(preset.key as Exclude<PresetKey, 'custom'>)}
				>
					{preset.label}
				</button>
			{/each}
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={addSigner}>Add Signer</button
			>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={addGroup}>Add Group</button
			>
			<button
				type="button"
				disabled={!canRemoveSelected}
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
				onclick={removeSelected}>Remove</button
			>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={resetAll}>Reset Protocol State</button
			>
		</div>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-300">Protocol Steps</h2>
		<div class="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
			{#each steps as step, index}
				<button
					type="button"
					onclick={() => jumpToStep(index, step.id)}
					disabled={index > completedStepIndex || (step.id === 'verify' && verificationResult === null)}
					class={[
						'flex min-w-[132px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
						stepClasses(index)
					]}
				>
					<span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
						{#if index < completedStepIndex || (step.id === 'verify' && verificationResult !== null)}
							✓
						{:else}
							{index + 1}
						{/if}
					</span>
					<span>{step.label}</span>
				</button>
				{#if index < steps.length - 1}
					<span class="text-zinc-500">→</span>
				{/if}
			{/each}
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={runKeyGen}>Run Key Gen</button
			>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={runRound1}>Run Round 1</button
			>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={runRound2}>Run Round 2</button
			>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
				onclick={runVerify}>Run Verify</button
			>
		</div>

		<p class="mt-3 text-sm text-zinc-300">{info}</p>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-300">Current Phase</h2>
			<button
				type="button"
				class="rounded-md border border-zinc-700 px-2 py-1 text-xs font-semibold hover:bg-zinc-800"
				onclick={() => (explanationsOpen = !explanationsOpen)}
			>
				{explanationsOpen ? 'Collapse' : 'Expand'}
			</button>
		</div>

		{#if explanationsOpen}
			<div class="mt-3 space-y-2">
				<h3 class="text-sm font-semibold text-zinc-100">{currentExplanation.title}</h3>
				<p class="text-sm text-zinc-300">{currentExplanation.text}</p>
				{#if currentExplanation.formula}
					<KaTeX math={currentExplanation.formula} displayMode />
				{/if}
			</div>
		{/if}
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
		<label class="block space-y-1">
			<span class="text-xs uppercase tracking-wide text-zinc-400">Message</span>
			<input
				class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
				bind:value={message}
				placeholder="Message to sign"
			/>
		</label>
		<div class="mt-2">
			<HexValue value={messageHex} label="m" />
		</div>
	</div>

	<CosignerFlow
		{tree}
		currentPhase={phase}
		onNodeSelect={(node) => {
			selectedNodeId = node?.id ?? null;
		}}
		onNodeLabelChange={renameNode}
	/>

	<div class="grid gap-4 xl:grid-cols-2">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Node Details</h2>
			{#if selectedNode}
				<p class="mb-3 text-sm font-semibold text-zinc-100">{selectedNode.label ?? selectedNode.id}</p>

				{#if selectedNode.role === 'leaf'}
					<div class="space-y-3">
						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Key Aggregation</h3>
							{#if selectedNode.pk}
								<HexValue value={pointHex(selectedNode.pk)} label="pk" />
							{/if}
							{#if selectedNode.aggCoef !== undefined}
								<KaTeX math={'a_i = H_{\\text{agg}}(L, X_i)'} />
								<div class="mt-1">
									<HexValue value={scalarHex(selectedNode.aggCoef)} label="a_i" />
								</div>
							{/if}
						</div>

						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Round 1</h3>
							{#if selectedNode.round1Out}
								<div class="flex flex-col gap-1">
									{#each selectedNode.round1Out.nonces as nonce, index}
										<HexValue value={pointHex(nonce)} label={`R${index + 1}`} />
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Round 2</h3>
							{#if selectedNode.partialSig !== undefined}
								<HexValue value={scalarHex(selectedNode.partialSig)} label="s" />
							{/if}
						</div>
					</div>
				{:else}
					<div class="space-y-3">
						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Key Aggregation</h3>
							{#if selectedNode.pk}
								<KaTeX math={'\\tilde{X} = \\prod X_i^{a_i}'} />
								<div class="mt-1">
									<HexValue value={pointHex(selectedNode.pk)} label="X~" />
								</div>
							{/if}

							{#if selectedNode.keyList && selectedNode.keyList.length > 0}
								<p class="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Key List</p>
								<div class="mt-1 flex flex-col gap-1">
									{#each selectedNode.keyList as keyPoint, index}
										<HexValue value={pointHex(keyPoint)} label={`X${index + 1}`} />
									{/each}
								</div>
							{/if}

							{#if selectedNode.children}
								<p class="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Child Coefficients</p>
								<div class="mt-1 flex flex-col gap-1">
									{#each selectedNode.children as child}
										{#if child.aggCoef !== undefined}
											<HexValue value={scalarHex(child.aggCoef)} label={`${child.label ?? child.id} a_i`} />
										{/if}
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Round 1</h3>
							{#if selectedNode.internalAgg}
								<div class="flex flex-col gap-1">
									{#each selectedNode.internalAgg as nonce, index}
										<HexValue value={pointHex(nonce)} label={`R'${index + 1}`} />
									{/each}
								</div>
							{/if}

							{#if selectedNode.bindingValue !== undefined}
								<KaTeX math={"b = H_{\\text{non}}(\\tilde{X}, R'_1, \\ldots, R'_\\nu)"} />
								<div class="mt-1">
									<HexValue value={scalarHex(selectedNode.bindingValue)} label="b" />
								</div>
							{/if}

							{#if selectedNode.round1Out}
								<div class="mt-1 flex flex-col gap-1">
									{#each selectedNode.round1Out.nonces as nonce, index}
										<HexValue value={pointHex(nonce)} label={`R${index + 1}`} />
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Round 2</h3>
							{#if selectedNode.partialSig !== undefined}
								<HexValue value={scalarHex(selectedNode.partialSig)} label="aggregate s" />
							{/if}
						</div>
					</div>
				{/if}
			{:else}
				<p class="text-sm text-zinc-400">Select a node in the flow to inspect key aggregation and signing state.</p>
			{/if}
		</div>

		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Verification</h2>
			<KaTeX math={'g^s = R \\cdot \\tilde{X}^c'} displayMode />

			{#if aggregateKeyHex}
				<HexValue value={aggregateKeyHex} label="X~" />
			{/if}
			{#if challengeHex}
				<div class="mt-1">
					<HexValue value={challengeHex} label="c" />
				</div>
			{/if}
			{#if signatureRHex}
				<div class="mt-1">
					<HexValue value={signatureRHex} label="R" />
				</div>
			{/if}
			{#if signatureSHex}
				<div class="mt-1">
					<HexValue value={signatureSHex} label="s" />
				</div>
			{/if}

			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800"
					onclick={runVerify}>Verify</button
				>
				<button
					type="button"
					disabled={!hasSignature}
					class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
					onclick={tamperSignature}>Tamper</button
				>
			</div>

			{#if verificationResult !== null}
				<p class={['mt-3 text-sm font-semibold', verificationResult ? 'text-emerald-300' : 'text-rose-300']}>
					Original signature: {verificationResult ? 'valid' : 'invalid'}
				</p>
			{/if}

			{#if tamperedSHex}
				<div class="mt-2">
					<HexValue value={tamperedSHex} label="tampered s" />
				</div>
			{/if}
			{#if tamperedResult !== null}
				<p class={['mt-2 text-sm font-semibold', tamperedResult ? 'text-amber-300' : 'text-rose-300']}>
					Tampered signature: {tamperedResult ? 'valid (unexpected)' : 'invalid (expected)'}
				</p>
			{/if}
		</div>
	</div>
</section>
