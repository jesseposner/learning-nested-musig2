<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Learning NestedMuSig2</title>
</svelte:head>

<section class="space-y-8">
	<div class="space-y-3">
		<p class="text-xs uppercase tracking-[0.2em] text-stone-400">NestedMuSig2 Explorer</p>
		<h1 class="text-3xl font-serif font-semibold text-stone-900 sm:text-4xl">Learning NestedMuSig2</h1>
		<p class="max-w-3xl text-stone-600">
			An interactive guide to nested multi-signatures on secp256k1, based on eprint 2026/223 by
			Nadav Kohen.
		</p>
		<div class="flex flex-wrap gap-3 pt-1">
			<a
				class="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
				href="{base}/learn/01-introduction">Start Learning</a
			>
			<a
				class="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
				href="{base}/playground">Open Playground</a
			>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<a
			class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-all hover:border-stone-300 hover:shadow"
			href="{base}/learn/01-introduction"
		>
			<h2 class="text-base font-semibold text-stone-900">Step-by-Step Narrative</h2>
			<p class="mt-2 text-sm text-stone-600">
				7 pages walking through the protocol from cosigner trees to verification.
			</p>
		</a>

		<a
			class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-all hover:border-stone-300 hover:shadow"
			href="{base}/playground"
		>
			<h2 class="text-base font-semibold text-stone-900">Interactive Playground</h2>
			<p class="mt-2 text-sm text-stone-600">
				Build custom cosigner trees, run the protocol step by step, inspect every intermediate value.
			</p>
		</a>

		<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Real Cryptography</h2>
			<p class="mt-2 text-sm text-stone-600">
				Uses real secp256k1 via <code>@noble/curves</code>, not toy numbers. Every signature verifies.
			</p>
		</div>
	</div>

	<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">Protocol Overview</h2>
		<p class="mt-2 text-sm text-stone-600">
			NestedMuSig2 is a recursive variant of MuSig2 for hierarchical signing groups, where leaves are
			individual signers and internal nodes aggregate subtree outputs.
		</p>
		<p class="mt-2 text-sm text-stone-600">
			Each level performs key and nonce aggregation, and Round 2 cascades coefficients and binding
			values from leaf to root. The final output is a standard Schnorr signature that is
			indistinguishable from flat MuSig2 to the verifier.
		</p>
	</div>
</section>
