<script lang="ts">
	import dagre from '@dagrejs/dagre';
	import {
		Background,
		Controls,
		MarkerType,
		Position,
		SvelteFlow,
		type Edge,
		type EdgeTypes,
		type Node,
		type NodeTypes
	} from '@xyflow/svelte';
	import type { CosignerTree, TreeNode } from '$lib/tree/types';
	import {
		createKeyGenTimeline,
		createRound1Timeline,
		createRound2Timeline,
		type Phase
	} from '$lib/stores/animation';
	import SignerNode from './SignerNode.svelte';
	import AggregatorNode from './AggregatorNode.svelte';
	import TreeEdge from './TreeEdge.svelte';

	type FlowNodeData = {
		treeNode: TreeNode;
		currentPhase: Phase;
		registerElement: (id: string, element: HTMLElement | null, depth: number) => void;
		onLabelChange?: (id: string, label: string) => void;
	};

	type FlowEdgeData = {
		currentPhase: Phase;
	};

	type FlowNode = Node<FlowNodeData, 'signer' | 'aggregator'>;
	type FlowEdge = Edge<FlowEdgeData, 'tree'>;

	let {
		tree = null,
		currentPhase = 'idle',
		onNodeSelect,
		onNodeLabelChange
	}: {
		tree?: CosignerTree | null;
		currentPhase?: Phase;
		onNodeSelect?: (node: TreeNode | null) => void;
		onNodeLabelChange?: (id: string, label: string) => void;
	} = $props();

	const nodeTypes: NodeTypes = {
		signer: SignerNode,
		aggregator: AggregatorNode
	};

	const edgeTypes: EdgeTypes = {
		tree: TreeEdge
	};

	let nodes = $state.raw<FlowNode[]>([]);
	let edges = $state.raw<FlowEdge[]>([]);
	let selectedNodeId = $state<string | null>(null);

	const nodeElements = new Map<string, HTMLElement>();
	let activeTimeline: ReturnType<typeof createKeyGenTimeline> | null = null;

	function registerElement(id: string, element: HTMLElement | null, depth: number): void {
		if (!element) {
			nodeElements.delete(id);
			return;
		}
		element.dataset.depth = `${depth}`;
		nodeElements.set(id, element);
	}

	function nodeSize(node: TreeNode): { width: number; height: number } {
		return node.role === 'leaf' ? { width: 280, height: 230 } : { width: 320, height: 320 };
	}

	function flattenTree(root: TreeNode): { treeNodes: TreeNode[]; links: Array<{ source: string; target: string }> } {
		const treeNodes: TreeNode[] = [];
		const links: Array<{ source: string; target: string }> = [];

		function visit(node: TreeNode): void {
			treeNodes.push(node);
			if (node.role === 'aggregator' && node.children) {
				for (const child of node.children) {
					links.push({ source: node.id, target: child.id });
					visit(child);
				}
			}
		}

		visit(root);
		return { treeNodes, links };
	}

	function layoutFlow(rawNodes: FlowNode[], rawEdges: FlowEdge[]): FlowNode[] {
		const dagreGraph = new dagre.graphlib.Graph();
		dagreGraph.setDefaultEdgeLabel(() => ({}));
		dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

		for (const node of rawNodes) {
			const size = nodeSize(node.data.treeNode);
			dagreGraph.setNode(node.id, { width: size.width, height: size.height });
		}

		for (const edge of rawEdges) {
			dagreGraph.setEdge(edge.source, edge.target);
		}

		dagre.layout(dagreGraph);

		return rawNodes.map((node) => {
			const size = nodeSize(node.data.treeNode);
			const position = dagreGraph.node(node.id) as { x: number; y: number };

			return {
				...node,
				position: {
					x: position.x - size.width / 2,
					y: position.y - size.height / 2
				},
				sourcePosition: Position.Bottom,
				targetPosition: Position.Top
			};
		});
	}

	function buildFlowState(currentTree: CosignerTree, phase: Phase): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
		const { treeNodes, links } = flattenTree(currentTree.root);

		const flowNodes: FlowNode[] = treeNodes.map((treeNode) => ({
			id: treeNode.id,
			type: treeNode.role === 'leaf' ? 'signer' : 'aggregator',
			draggable: false,
			selectable: true,
			data: {
				treeNode,
				currentPhase: phase,
				registerElement,
				onLabelChange: onNodeLabelChange
			},
			position: { x: 0, y: 0 }
		}));

		const flowEdges: FlowEdge[] = links.map((link) => ({
			id: `${link.source}-${link.target}`,
			source: link.source,
			target: link.target,
			type: 'tree',
			data: {
				currentPhase: phase
			},
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: '#A8A29E'
			}
		}));

		return {
			flowNodes: layoutFlow(flowNodes, flowEdges),
			flowEdges
		};
	}

	function handleNodeClick({ node }: { node: FlowNode }): void {
		selectedNodeId = node.id;
		onNodeSelect?.(node.data.treeNode);
	}

	function handlePaneClick(): void {
		selectedNodeId = null;
		onNodeSelect?.(null);
	}

	$effect(() => {
		const activeTree = tree;
		const phase = currentPhase;
		const selected = selectedNodeId;

		if (!activeTree) {
			nodes = [];
			edges = [];
			return;
		}

		const { flowNodes, flowEdges } = buildFlowState(activeTree, phase);

		nodes = flowNodes.map((node) => ({
			...node,
			selected: node.id === selected
		}));
		edges = flowEdges;
	});

	$effect(() => {
		const phase = currentPhase;
		const hasElements = nodeElements.size > 0;

		activeTimeline?.kill();
		activeTimeline = null;

		if (!hasElements) {
			return;
		}

		if (phase === 'keygen') {
			activeTimeline = createKeyGenTimeline(nodeElements);
		} else if (phase === 'round1') {
			activeTimeline = createRound1Timeline(nodeElements);
		} else if (phase === 'round2' || phase === 'verify') {
			activeTimeline = createRound2Timeline(nodeElements);
		}

		activeTimeline?.play(0);

		return () => {
			activeTimeline?.kill();
		};
	});
</script>

<div class="h-[680px] w-full overflow-hidden rounded-xl border border-stone-200 bg-cream">
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		{edgeTypes}
		fitView
		minZoom={0.2}
		maxZoom={2.2}
		nodesDraggable={false}
		nodesConnectable={false}
		elementsSelectable={true}
		onnodeclick={handleNodeClick}
		onpaneclick={handlePaneClick}
	>
		<Background />
		<Controls />
	</SvelteFlow>
</div>
