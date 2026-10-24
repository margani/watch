<script lang="ts">
	import { profileUrl } from '#lib/watch.ts';

	interface Props {
		name: string;
		path: string | null | undefined;
		/** lg: the top of a person's page. */
		size?: 'sm' | 'lg';
	}

	let { name, path, size = 'sm' }: Props = $props();
	const src = $derived(profileUrl(path));
	const initials = $derived(
		name
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
	let failed = $state(false);

	// An image that failed before hydration never reports it: Svelte replays load/error through
	// inline handlers, which the CSP blocks (as in Poster).
	function check(img: HTMLImageElement) {
		if (img.complete && img.naturalWidth === 0) failed = true;
	}
</script>

<!-- The name is next to it, so the picture itself says nothing to a screen reader. -->
<span
	class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold text-ink-2 {size ===
	'lg'
		? 'size-24 text-2xl sm:size-28'
		: 'size-14 text-sm'}"
	aria-hidden="true"
>
	{initials}
	{#if src && !failed}
		<img
			{src}
			alt=""
			class="absolute inset-0 size-full object-cover object-top"
			loading="lazy"
			onerror={() => (failed = true)}
			{@attach check}
		/>
	{/if}
</span>
