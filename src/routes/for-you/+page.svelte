<script lang="ts">
	import JustWatchCredit from '#lib/components/JustWatchCredit.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import TitleRow from '#lib/components/TitleRow.svelte';
	import TmdbCredit from '#lib/components/TmdbCredit.svelte';
	import { formatAirDate, newsLabel, titleHref } from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const today = new Date().toISOString().slice(0, 10);
	const newer = $derived(
		data.newer.map((p) => ({
			...p,
			note:
				p.releaseDate && p.releaseDate > today
					? `Out ${formatAirDate(p.releaseDate)} · after ${p.after}`
					: `After ${p.after}`
		}))
	);
	const anything = $derived(
		data.news.length ||
			newer.length ||
			data.popularTv.length ||
			data.popularFilms.length ||
			data.ratedTv.length ||
			data.ratedFilms.length
	);
</script>

<svelte:head><title>For you · Watch</title></svelte:head>

<a href="/" class="mb-4 inline-block text-sm text-ink-2 hover:text-ink">← Films and series</a>
<h1 class="mb-6 font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">For you</h1>

{#if data.news.length}
	<section class="mb-8" aria-labelledby="new-heading">
		<h2 id="new-heading" class="mb-3 font-serif text-lg font-semibold">New on your list</h2>
		<ul class="flex flex-col gap-2">
			{#each data.news as n (n.id)}
				<li>
					<a href={titleHref(n)} class="group flex items-center gap-3">
						<Poster
							title={n.title}
							path={n.posterPath}
							size="w185"
							showTitle={false}
							class="w-10 shrink-0"
						/>
						<div class="min-w-0 text-sm">
							<p class="font-semibold group-hover:text-accent">{n.title}</p>
							<p class="text-ink-2">
								{newsLabel(n)}{#if n.airDate},<span class="whitespace-nowrap"
										>&nbsp;{formatAirDate(n.airDate)}</span
									>{/if}
							</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<TitleRow heading="Newer films after ones you have seen" titles={newer} />

{#if !data.country || !data.services.length}
	<p class="mb-8 card p-4 text-sm text-ink-2">
		<a href="/services" class="text-accent underline">Choose your streaming services</a>
		to see what is popular and well rated on them.
	</p>
{:else}
	<TitleRow heading="Popular series on your services" titles={data.popularTv} />
	<TitleRow heading="Popular films on your services" titles={data.popularFilms} />
	<TitleRow heading="Well rated series on your services" titles={data.ratedTv} />
	<TitleRow heading="Well rated films on your services" titles={data.ratedFilms} />
{/if}

{#if data.failed}
	<p class="mb-6 text-sm text-muted">TMDB did not answer for some of this; try again later.</p>
{/if}
{#if !anything && data.services.length}
	<p class="card p-6 text-center text-sm text-ink-2">
		Nothing new to suggest right now: everything popular on your services is on your list already.
	</p>
{/if}

{#if data.services.length}<JustWatchCredit />{/if}
<TmdbCredit demo={data.demo} />
