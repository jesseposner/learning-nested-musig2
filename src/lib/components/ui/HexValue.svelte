<script lang="ts">
	let {
		value,
		label,
		length = 8
	}: {
		value: string;
		label?: string;
		length?: number;
	} = $props();

	let expanded = $state(false);
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	const normalized = $derived(value.startsWith('0x') ? value.slice(2) : value);
	const leftCount = $derived(Math.max(4, length - 2));
	const rightCount = 4;

	const truncated = $derived(
		normalized.length > leftCount + rightCount
			? `${normalized.slice(0, leftCount)}...${normalized.slice(-rightCount)}`
			: normalized
	);

	const shown = $derived(expanded ? normalized : truncated);

	function toggleExpanded() {
		expanded = !expanded;
	}

	function toggleExpandedWithKeyboard(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpanded();
		}
	}

	async function copyValue(event: MouseEvent) {
		event.stopPropagation();
		try {
			await navigator.clipboard.writeText(normalized);
			copied = true;
			if (copyTimeout) {
				clearTimeout(copyTimeout);
			}
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 1200);
		} catch {
			copied = false;
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	class="group inline-flex items-center gap-2 rounded bg-zinc-800 px-1.5 py-1 text-left text-xs font-mono text-zinc-200 hover:bg-zinc-700"
	onclick={toggleExpanded}
	onkeydown={toggleExpandedWithKeyboard}
>
	{#if label}
		<span class="font-semibold uppercase text-[10px] tracking-wide text-zinc-400">{label}</span>
	{/if}
	<span class="break-all">{shown}</span>
	<button
		type="button"
		class="pointer-events-none rounded border border-zinc-600 px-1 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
		onclick={copyValue}
	>
		{copied ? 'copied' : 'copy'}
	</button>
</div>
