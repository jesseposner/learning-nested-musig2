<script lang="ts">
	import katex from 'katex';

	let {
		math,
		displayMode = false
	}: {
		math: string;
		displayMode?: boolean;
	} = $props();

	const html = $derived.by(() => {
		try {
			return katex.renderToString(math, {
				displayMode,
				throwOnError: false,
				strict: 'ignore'
			});
		} catch {
			return katex.renderToString('\\text{Invalid math}', {
				displayMode,
				throwOnError: false,
				strict: 'ignore'
			});
		}
	});
</script>

<div class={displayMode ? 'my-2 overflow-x-auto' : 'inline'}>{@html html}</div>
