<script lang="ts">
	import { logoUrl, type Provider } from '#lib/watch.ts';

	interface Props {
		provider: Provider;
		class?: string;
		/** Beside the service's name, the logo says nothing more: screen viewers skip it. */
		decorative?: boolean;
	}
	let { provider, class: cls = 'size-8', decorative = false }: Props = $props();
	const src = $derived(logoUrl(provider.logoPath));
</script>

<!-- A service's logo from TMDB, or its initials when there is none (the demo has no logos). -->
{#if src}
	<img
		{src}
		alt={decorative ? '' : provider.name}
		title={provider.name}
		class="{cls} shrink-0 rounded-md"
		loading="lazy"
	/>
{:else}
	<span
		class="{cls} inline-flex shrink-0 items-center justify-center rounded-md bg-surface-2 text-[0.6rem] font-semibold text-ink-2"
		title={provider.name}
		role={decorative ? 'presentation' : 'img'}
		aria-label={decorative ? undefined : provider.name}
		>{provider.name
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 3)}</span
	>
{/if}
