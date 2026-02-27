<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { children } = $props();

	const pages = [
		{ slug: '00-notation', title: 'Notation Guide' },
		{ slug: '01-introduction', title: 'Introduction' },
		{ slug: '02-cosigner-tree', title: 'Cosigner Tree' },
		{ slug: '03-key-aggregation', title: 'Key Aggregation' },
		{ slug: '04-round-one', title: 'Round One' },
		{ slug: '05-round-two', title: 'Round Two' },
		{ slug: '06-verification', title: 'Verification' },
		{ slug: '07-playground-guide', title: 'Playground Guide' }
	];

	const currentSlug = $derived(page.params.slug ?? '01-introduction');
	const pageCountLabel = $derived(`Narrative (${pages.length} pages)`);
</script>

<div class="grid gap-6 lg:grid-cols-[240px_1fr]">
	<aside class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">{pageCountLabel}</h2>
		<nav class="space-y-1">
			{#each pages as page}
				<a
					class={[
						'block rounded px-2 py-1 text-sm transition-colors',
						currentSlug === page.slug
							? 'bg-indigo-50 text-indigo-700 font-semibold'
							: 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
					]}
					aria-current={currentSlug === page.slug ? 'page' : undefined}
					href={`${base}/learn/${page.slug}`}>{page.title}</a
				>
			{/each}
		</nav>
	</aside>
	<article class="prose prose-stone max-w-none rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
		{@render children()}
	</article>
</div>
