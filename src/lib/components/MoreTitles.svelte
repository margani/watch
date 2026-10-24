<script lang="ts">
	import Poster from './Poster.svelte';
	import { STATUS_LABEL, titleHref, type Media, type Suggestion } from '#lib/watch.ts';

	// A title's Related row (sequels, its film series, spin-offs) and More like this (#31). Asked
	// after the page shows: Wikidata and the lookups behind it can take a second or two.
	interface Props {
		media: Media;
		tmdbId: number;
	}
	let { media, tmdbId }: Props = $props();

	type More = { related: Suggestion[]; similar: Suggestion[] };
	let more = $state<More | null>(null);

	$effect(() => {
		const url = `/api/${media}/${tmdbId}/more`;
		more = null;
		const controller = new AbortController();
		fetch(url, { signal: controller.signal })
			.then((r) => (r.ok ? (r.json() as Promise<More>) : null))
			.then((body) => (more = body))
			// Leaving the page cancels it; a failure leaves the rows out.
			.catch(() => {});
		return () => controller.abort();
	});

	const rows = $derived(
		more
			? ([
					['related', 'Related', more.related],
					['similar', 'More like this', more.similar]
				] as const)
			: []
	);
</script>

{#each rows as [key, label, list] (key)}
	{#if list.length}
		<section class="mt-8" aria-labelledby="more-{key}">
			<h2 id="more-{key}" class="mb-3 font-semibold">{label}</h2>
			<ul
				class="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6"
				aria-label={label}
			>
				{#each list as h (`${h.media}-${h.tmdbId}`)}
					<li class="w-28 shrink-0 snap-start sm:w-32">
						<a href={titleHref(h)} class="group block">
							<div class="relative">
								<Poster
									title={h.title}
									path={h.posterPath}
									size="w342"
									showTitle={false}
									class="w-full"
								/>
								{#if h.status}
									<span
										class="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-medium text-accent-ink shadow"
										>{STATUS_LABEL[h.status]}</span
									>
								{/if}
							</div>
							<span
								class="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold group-hover:text-accent"
								>{h.title}</span
							>
							<span class="block text-xs text-muted">
								{h.media === 'tv' ? 'Series' : 'Film'}{#if h.year}&nbsp;· {h.year}{/if}
							</span>
							{#if h.imdb}
								<span class="block text-xs font-semibold">IMDb {h.imdb.rating.toFixed(1)}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/each}
