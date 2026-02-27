<script lang="ts">
	import HexValue from '$lib/components/ui/HexValue.svelte';
	import KaTeX from '$lib/components/ui/KaTeX.svelte';
	import { keyAgg, keyAggCoef, keyGen } from '$lib/crypto/keygen';
	import { bytesToHex, serializePoint, serializeScalar, type Point } from '$lib/crypto/utils';

	type SignerRow = {
		name: string;
		sk: bigint;
		pk: Point;
		coef: bigint;
	};

	const signerNames = ['Alice', 'Bob', 'Carol'];
	let rows = $state<SignerRow[]>([]);

	const aggregateKeyHex = $derived.by(() => {
		if (rows.length === 0) {
			return '';
		}
		return bytesToHex(serializePoint(keyAgg(rows.map((row) => row.pk))));
	});

	function scalarHex(value: bigint): string {
		return bytesToHex(serializeScalar(value));
	}

	function pointHex(point: Point): string {
		return bytesToHex(serializePoint(point));
	}

	function regenerate(): void {
		const generated = signerNames.map((name) => ({ name, ...keyGen(), coef: 0n }));
		const keyList = generated.map((entry) => entry.pk);
		rows = generated.map((entry) => ({
			...entry,
			coef: keyAggCoef(keyList, entry.pk)
		}));
	}

	regenerate();
</script>

<div class="not-prose space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
	<div class="flex items-center justify-between gap-3">
		<h3 class="text-sm font-semibold text-stone-900">Key Aggregation Demo</h3>
		<button
			type="button"
			class="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
			onclick={regenerate}>Regenerate</button
		>
	</div>

	<KaTeX math={'a_i = H_{\\text{agg}}(L, X_i),\\ \\tilde{X}=\\prod X_i^{a_i}'} displayMode />

	<div class="space-y-3">
		{#each rows as row}
			<div class="rounded-md border border-stone-200 bg-white p-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{row.name}</p>
				<div class="flex flex-col gap-1">
					<HexValue value={pointHex(row.pk)} label="pk" />
					<HexValue value={scalarHex(row.coef)} label="a_i" />
				</div>
			</div>
		{/each}
	</div>

	{#if aggregateKeyHex}
		<div class="rounded-md border border-emerald-300 bg-emerald-50 p-3">
			<HexValue value={aggregateKeyHex} label="X~" />
		</div>
	{/if}
</div>
