<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import X from '@lucide/svelte/icons/x';
	import type { Trailer } from '#lib/watch.ts';

	let { trailer, title }: { trailer: Trailer; title: string } = $props();
	// Nothing comes from YouTube until play is tapped (#19); then its no-cookie player.
	let open = $state(false);
	const src = $derived(
		`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`
	);
</script>

{#if open}
	<div class="mt-4">
		<div class="relative aspect-video overflow-hidden rounded-2xl bg-black">
			<iframe
				{src}
				title="{trailer.name}: {title}"
				class="absolute inset-0 size-full"
				allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
		<button
			type="button"
			class="mt-1 inline-flex h-11 items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
			onclick={() => (open = false)}><X class="size-4" aria-hidden="true" /> Close trailer</button
		>
	</div>
{:else}
	<button
		type="button"
		class="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 pr-5 pl-4 text-sm font-medium hover:bg-line"
		onclick={() => (open = true)}
		><Play class="size-4 fill-current" aria-hidden="true" /> Play trailer</button
	>
{/if}
