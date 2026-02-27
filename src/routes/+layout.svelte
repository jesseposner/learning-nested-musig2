<script lang="ts">
	import '@xyflow/svelte/dist/style.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
</svelte:head>

<div class="min-h-screen bg-cream text-stone-900 font-sans">
	<nav class="border-b border-stone-200 bg-white/80 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
			<a class="text-sm font-semibold tracking-wide text-stone-600 hover:text-indigo-700" href="{base}/">Home</a>
			<a class="text-sm font-semibold tracking-wide text-stone-600 hover:text-indigo-700" href="{base}/learn/01-introduction"
				>Learn</a
			>
			<a class="text-sm font-semibold tracking-wide text-stone-600 hover:text-indigo-700" href="{base}/playground"
				>Playground</a
			>
		</div>
	</nav>
	<main class="mx-auto max-w-6xl px-4 py-6 [&_code]:font-mono">
		{@render children()}
	</main>
</div>
