<svelte:head>
	<title>Learning NestedMuSig2</title>
</svelte:head>

<section class="space-y-8">
	<div class="space-y-3">
		<p class="text-xs uppercase tracking-[0.2em] text-zinc-400">NestedMuSig2 Explorer</p>
		<h1 class="text-3xl font-semibold text-zinc-100 sm:text-4xl">Learning NestedMuSig2</h1>
		<p class="max-w-3xl text-zinc-300">
			An interactive guide to nested multi-signatures on secp256k1, based on eprint 2026/223 by
			Nadav Kohen.
		</p>
		<div class="flex flex-wrap gap-3 pt-1">
			<a
				class="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
				href="/learn/01-introduction">Start Learning</a
			>
			<a
				class="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
				href="/playground">Open Playground</a
			>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<a
			class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
			href="/learn/01-introduction"
		>
			<h2 class="text-base font-semibold text-zinc-100">Step-by-Step Narrative</h2>
			<p class="mt-2 text-sm text-zinc-300">
				7 pages walking through the protocol from cosigner trees to verification.
			</p>
		</a>

		<a
			class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
			href="/playground"
		>
			<h2 class="text-base font-semibold text-zinc-100">Interactive Playground</h2>
			<p class="mt-2 text-sm text-zinc-300">
				Build custom cosigner trees, run the protocol step by step, inspect every intermediate value.
			</p>
		</a>

		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="text-base font-semibold text-zinc-100">Real Cryptography</h2>
			<p class="mt-2 text-sm text-zinc-300">
				Uses real secp256k1 via <code>@noble/curves</code>, not toy numbers. Every signature verifies.
			</p>
		</div>
	</div>

	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-300">Protocol Overview</h2>
		<p class="mt-2 text-sm text-zinc-300">
			NestedMuSig2 is a recursive variant of MuSig2 for hierarchical signing groups, where leaves are
			individual signers and internal nodes aggregate subtree outputs.
		</p>
		<p class="mt-2 text-sm text-zinc-300">
			Each level performs key and nonce aggregation, and Round 2 cascades coefficients and binding
			values from leaf to root. The final output is a standard Schnorr signature that is
			indistinguishable from flat MuSig2 to the verifier.
		</p>
	</div>
</section>
