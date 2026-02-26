<script lang="ts">
type PageData = {
		component: unknown;
		metadata: Record<string, unknown>;
		slug: string;
	};

	let { data } = $props<{ data: PageData }>();
	const Content = $derived(data.component as any);
</script>

<Content />
