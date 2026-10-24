<script lang="ts">
	import Poster from '#lib/components/Poster.svelte';
	import TmdbCredit from '#lib/components/TmdbCredit.svelte';
	import WatchSearch from '#lib/components/WatchSearch.svelte';
	import { titleHref } from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ''}Films and series · Watch</title></svelte:head>

<div class="mb-2 flex items-baseline justify-between gap-3">
	<h1 class="font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">Search</h1>
	<a href="/" class="text-sm text-ink-2 hover:text-ink">My list</a>
</div>

<div class="mb-6">
	{#key data.q}<WatchSearch q={data.q} autofocus={!data.q} />{/key}
</div>

{#if data.failed}
	<p class="card px-6 py-8 text-center text-sm text-ink-2" role="alert">
		Search is not working right now: {data.failed} Your list still works.
	</p>
{:else if data.q && !data.hits.length}
	<p class="card px-6 py-12 text-center text-sm text-ink-2">Nothing found for “{data.q}”.</p>
{:else if data.hits.length}
	<ul class="flex flex-col gap-3" aria-label="Results">
		{#each data.hits as h (`${h.media}-${h.tmdbId}`)}
			<li>
				<a href={titleHref(h)} class="group flex gap-4 card p-3 hover:border-accent">
					<Poster
						title={h.title}
						path={h.posterPath}
						size="w185"
						showTitle={false}
						class="w-16 shrink-0 sm:w-20"
					/>
					<div class="min-w-0">
						<h2 class="leading-snug font-semibold group-hover:text-accent">{h.title}</h2>
						<p class="text-xs text-muted">
							{h.media === 'tv' ? 'Series' : 'Film'}{#if h.year}&nbsp;· {h.year}{/if}
						</p>
						{#if h.overview}
							<p class="mt-1 line-clamp-2 text-sm text-ink-2">{h.overview}</p>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<TmdbCredit demo={data.demo} />
