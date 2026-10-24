<script lang="ts">
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import { posterUrl } from '#lib/watch.ts';

	interface Props {
		title: string;
		path: string | null;
		size?: 'w185' | 'w342' | 'w500';
		class?: string;
		eager?: boolean;
		/** The title on the stand-in poster; too small to read in a search row. */
		showTitle?: boolean;
	}

	let {
		title,
		path,
		size = 'w342',
		class: className = '',
		eager = false,
		showTitle = true
	}: Props = $props();
	const src = $derived(posterUrl(path, size));
	let failed = $state(false);

	// An image that failed before hydration never reports it: Svelte replays load/error through
	// inline handlers, which the CSP blocks (same as Cover, 2026-10-12).
	function check(img: HTMLImageElement) {
		if (img.complete && img.naturalWidth === 0) failed = true;
	}
</script>

<div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 {className}">
	<div class="flex size-full flex-col items-center justify-center gap-2 p-[10%] text-center">
		<Clapperboard class="size-6 text-muted" aria-hidden="true" />
		{#if showTitle}
			<span class="line-clamp-4 font-serif text-sm leading-tight font-semibold text-ink-2"
				>{title}</span
			>
		{/if}
	</div>
	{#if src && !failed}
		<img
			{src}
			alt=""
			class="absolute inset-0 size-full object-cover"
			loading={eager ? 'eager' : 'lazy'}
			onerror={() => (failed = true)}
			{@attach check}
		/>
	{/if}
</div>
