import { gsap } from 'gsap';

export type Phase = 'idle' | 'keygen' | 'round1' | 'round2' | 'verify';

function groupByDepth(nodeElements: Map<string, HTMLElement>): number[] {
	const depths = new Set<number>();
	for (const element of nodeElements.values()) {
		const rawDepth = Number.parseInt(element.dataset.depth ?? '0', 10);
		depths.add(Number.isFinite(rawDepth) ? rawDepth : 0);
	}
	return [...depths].sort((a, b) => b - a);
}

function nodesAtDepth(nodeElements: Map<string, HTMLElement>, depth: number): HTMLElement[] {
	const result: HTMLElement[] = [];
	for (const element of nodeElements.values()) {
		const elementDepth = Number.parseInt(element.dataset.depth ?? '0', 10);
		if ((Number.isFinite(elementDepth) ? elementDepth : 0) === depth) {
			result.push(element);
		}
	}
	return result;
}

function createBottomUpTimeline(nodeElements: Map<string, HTMLElement>, glowColor: string): gsap.core.Timeline {
	const timeline = gsap.timeline({ paused: true });
	const depths = groupByDepth(nodeElements);

	for (const depth of depths) {
		const levelNodes = nodesAtDepth(nodeElements, depth);
		if (levelNodes.length === 0) {
			continue;
		}

		const valueElements = levelNodes.flatMap((element) =>
			Array.from(element.querySelectorAll('.nm-node-value')) as HTMLElement[]
		);

		timeline.to(levelNodes, {
			duration: 0.22,
			scale: 1.03,
			boxShadow: `0 0 0 1px ${glowColor}, 0 0 28px ${glowColor}55`,
			stagger: 0.06,
			ease: 'power2.out'
		});

		if (valueElements.length > 0) {
			timeline.fromTo(
				valueElements,
				{ opacity: 0.35, y: 4 },
				{ duration: 0.18, opacity: 1, y: 0, stagger: 0.02, ease: 'power1.out' },
				'<'
			);
		}

		timeline.to(levelNodes, {
			duration: 0.18,
			scale: 1,
			boxShadow: '0 0 0 1px rgba(113,113,122,0.45)',
			stagger: 0.05,
			ease: 'power2.out'
		});
	}

	return timeline;
}

export function createKeyGenTimeline(nodeElements: Map<string, HTMLElement>): gsap.core.Timeline {
	return createBottomUpTimeline(nodeElements, '#38bdf8');
}

export function createRound1Timeline(nodeElements: Map<string, HTMLElement>): gsap.core.Timeline {
	return createBottomUpTimeline(nodeElements, '#f59e0b');
}

export function createRound2Timeline(nodeElements: Map<string, HTMLElement>): gsap.core.Timeline {
	return createBottomUpTimeline(nodeElements, '#34d399');
}
