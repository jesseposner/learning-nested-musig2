<script lang="ts">
	import '@xyflow/svelte/dist/style.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
	<nav class="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
			<a class="text-sm font-semibold tracking-wide text-zinc-100 hover:text-zinc-300" href="{base}/">Home</a>
			<a class="text-sm font-semibold tracking-wide text-zinc-100 hover:text-zinc-300" href="{base}/learn/01-introduction"
				>Learn</a
			>
			<a class="text-sm font-semibold tracking-wide text-zinc-100 hover:text-zinc-300" href="{base}/playground"
				>Playground</a
			>
		</div>
	</nav>
	<main class="mx-auto max-w-6xl px-4 py-6 [&_code]:font-mono">
		{@render children()}
	</main>
</div>
