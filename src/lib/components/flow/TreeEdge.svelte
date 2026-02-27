<script lang="ts">
	import { getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import { gsap } from 'gsap';
	import type { Phase } from '$lib/stores/animation';

	type TreeEdgeData = {
		currentPhase?: Phase;
	};

	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		markerStart,
		markerEnd,
		style,
		data
	}: EdgeProps = $props();

	let pathElement: SVGPathElement | null = null;
	let path = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition
		})[0]
	);

	const phase = $derived((data as TreeEdgeData | undefined)?.currentPhase ?? 'idle');
	let animation: gsap.core.Tween | null = null;

	function phaseStrokeColor(currentPhase: Phase): string {
		switch (currentPhase) {
			case 'keygen':
				return '#4338CA';
			case 'round1':
				return '#D97706';
			case 'round2':
				return '#059669';
			case 'verify':
				return '#16A34A';
			default:
				return '#A8A29E';
		}
	}

	$effect(() => {
		if (!pathElement) {
			return;
		}

		animation?.kill();
		const stroke = phaseStrokeColor(phase);

		gsap.set(pathElement, {
			stroke,
			opacity: phase === 'idle' ? 0.65 : 0.95
		});

		if (phase === 'round1' || phase === 'round2' || phase === 'verify') {
			gsap.set(pathElement, { strokeDasharray: '9 6', strokeDashoffset: 0 });
			animation = gsap.to(pathElement, {
				strokeDashoffset: -30,
				duration: 1.1,
				ease: 'none',
				repeat: -1
			});
		} else {
			gsap.set(pathElement, { strokeDasharray: 'none', strokeDashoffset: 0 });
		}

		return () => {
			animation?.kill();
		};
	});
</script>

<g class="nm-tree-edge">
	<path
		bind:this={pathElement}
		{id}
		d={path}
		class="svelte-flow__edge-path nm-tree-edge-path"
		fill="none"
		stroke-width="2"
		stroke-linecap="round"
		marker-start={markerStart}
		marker-end={markerEnd}
		{style}
	/>
	<path d={path} class="svelte-flow__edge-interaction" stroke-opacity={0} stroke-width={20} fill="none" />
</g>
