<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const sha = $derived(/^[0-9a-f]{7,40}$/.test(data.commit) ? data.commit : null);
	const built = $derived(
		new Date(data.built).toLocaleString('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		}) + ' UTC'
	);
</script>

<svelte:head><title>About · Watch</title></svelte:head>

<h1 class="font-serif text-2xl font-semibold sm:text-3xl">About Watch</h1>
<p class="mt-2 max-w-prose text-ink-2">
	Films and series you want to watch, are watching and have seen. Open source and self-hostable.
</p>

<dl class="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
	<dt class="text-muted">Version</dt>
	<dd class="font-medium">{data.version}</dd>
	<dt class="text-muted">Commit</dt>
	<dd>
		{#if sha}
			<a
				href="{data.source}/commit/{sha}"
				class="font-mono font-medium text-accent hover:underline"
				rel="noopener noreferrer">{sha.slice(0, 7)}</a
			>
		{:else}
			<span class="font-mono">{data.commit}</span>
		{/if}
	</dd>
	<dt class="text-muted">Built</dt>
	<dd><time datetime={data.built}>{built}</time></dd>
	<dt class="text-muted">Source</dt>
	<dd>
		<a
			href={data.source}
			class="inline-flex items-center gap-1 text-accent hover:underline"
			rel="noopener noreferrer"
			>{data.source.replace(/^https:\/\//, '')}
			<ExternalLink class="size-3.5" aria-hidden="true" /></a
		>
	</dd>
	<dt class="text-muted">Licence</dt>
	<dd>MIT</dd>
</dl>

<!-- TMDB's terms: its logo, less prominent than the app's, and this exact notice, in an About or
     Credits section. JustWatch is credited beside its data too, and IMDb's datasets ask for theirs. -->
<section class="mt-10 max-w-prose border-t border-line pt-6 text-sm" aria-labelledby="credits">
	<h2 id="credits" class="font-semibold">Credits</h2>
	<a href="https://www.themoviedb.org/" class="mt-3 inline-flex" rel="noopener noreferrer">
		<img src="/credits/tmdb.svg" alt="TMDB" class="h-3" />
	</a>
	<p class="mt-2 text-ink-2">
		This product uses the TMDB API but is not endorsed or certified by TMDB.
	</p>
	<p class="mt-3 text-ink-2">
		Where to watch: data by
		<a href="https://www.justwatch.com/" class="underline hover:text-ink" rel="noopener noreferrer"
			>JustWatch</a
		>.
	</p>
	<p class="mt-3 text-ink-2">
		IMDb ratings: information courtesy of
		<a href="https://www.imdb.com" class="underline hover:text-ink" rel="noopener noreferrer"
			>IMDb</a
		>
		(https://www.imdb.com). Used with permission.
	</p>
</section>
