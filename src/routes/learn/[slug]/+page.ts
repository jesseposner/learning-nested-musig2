import { error } from '@sveltejs/kit';

const pages = import.meta.glob('/src/content/*.svx');

type MdsvexModule = {
	default: unknown;
	metadata?: Record<string, unknown>;
};

export async function load({ params }: { params: { slug: string } }) {
	const key = `/src/content/${params.slug}.svx`;
	const resolver = pages[key];

	if (!resolver) {
		throw error(404, `Unknown learning page: ${params.slug}`);
	}

	const mod = (await resolver()) as MdsvexModule;
	return {
		component: mod.default,
		metadata: mod.metadata ?? {},
		slug: params.slug
	};
}
