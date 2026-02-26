<script lang="ts">
	type PageData = {
		component: unknown;
		metadata: Record<string, unknown>;
		slug: string;
	};

	let { data } = $props<{ data: PageData }>();
	const Content = $derived(data.component as any);

	const pages = [
		{ slug: '01-introduction', title: 'Introduction' },
		{ slug: '02-cosigner-tree', title: 'Cosigner Tree' },
		{ slug: '03-key-aggregation', title: 'Key Aggregation' },
		{ slug: '04-round-one', title: 'Round One' },
		{ slug: '05-round-two', title: 'Round Two' },
		{ slug: '06-verification', title: 'Verification' },
		{ slug: '07-playground-guide', title: 'Playground Guide' }
	] as const;

	const currentIndex = $derived(pages.findIndex((page) => page.slug === data.slug));
	const prevPage = $derived(currentIndex > 0 ? pages[currentIndex - 1] : null);
	const nextPage = $derived(currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null);
	const metadataTitle = $derived(typeof data.metadata.title === 'string' ? data.metadata.title : null);
	const pageTitle = $derived(
		metadataTitle ? `${metadataTitle} | Learning NestedMuSig2` : 'Learning NestedMuSig2'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<Content />

<nav class="not-prose mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
	<div>
		{#if prevPage}
			<a
				class="inline-flex items-center rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
				href={`/learn/${prevPage.slug}`}>← {prevPage.title}</a
			>
		{/if}
	</div>
	<div>
		{#if nextPage}
			<a
				class="inline-flex items-center rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
				href={`/learn/${nextPage.slug}`}>{nextPage.title} →</a
			>
		{/if}
	</div>
</nav>
