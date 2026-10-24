<script lang="ts">
	import JustWatchCredit from '#lib/components/JustWatchCredit.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import ProviderLogo from '#lib/components/ProviderLogo.svelte';
	import TmdbCredit from '#lib/components/TmdbCredit.svelte';
	import WatchSearch from '#lib/components/WatchSearch.svelte';
	import { invalidate } from '$app/navigation';
	import {
		episodeLabel,
		formatAirDate,
		newsLabel,
		progressLabel,
		STATUS_LABEL,
		titleHref,
		WATCH_STATUSES
	} from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let clearing = $state(false);
	let emailOverride = $state<boolean | null>(null);
	const emailNews = $derived(emailOverride ?? data.emailNews);
	let saveFailed = $state(false);

	async function clearNews() {
		clearing = true;
		try {
			const res = await fetch('/api/news/seen', { method: 'POST' });
			if (res.ok) await invalidate('app:watch-news');
		} finally {
			clearing = false;
		}
	}

	async function setEmail(on: boolean) {
		emailOverride = on;
		saveFailed = false;
		const res = await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ emailNews: on })
		}).catch(() => null);
		if (!res?.ok) {
			emailOverride = !on;
			saveFailed = true;
		}
	}
	const empty: Record<string, string> = {
		want: 'Films and series you add to watch later show up here.',
		watching: 'Series and films you are in the middle of show up here.',
		watched: 'What you have seen, with your own rating, is kept here.'
	};
</script>

<svelte:head><title>My list · Watch</title></svelte:head>

<h1 class="mb-4 font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">Films and series</h1>

<div class="mb-3"><WatchSearch /></div>

<p class="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2">
	{#if data.services.length}
		<span>Your services:</span>
		{#each data.services as p (p.id)}<ProviderLogo provider={p} class="size-6" />{/each}
		<a href="/services" class="text-accent hover:underline">Change</a>
	{:else}
		<a href="/services" class="text-accent hover:underline">Choose your streaming services</a>
		<span class="text-muted">to see which of them has each title.</span>
	{/if}
	<span class="text-muted" aria-hidden="true">·</span>
	<a href="/import" class="text-accent hover:underline">Import from Netflix</a>
</p>

{#if data.news.length}
	<section class="mb-8 rounded-2xl bg-accent-soft p-4" aria-labelledby="news-heading">
		<div class="mb-3 flex items-center justify-between gap-3">
			<h2 id="news-heading" class="text-sm font-bold tracking-wide text-accent uppercase">New</h2>
			<button type="button" class="btn-ghost h-9" disabled={clearing} onclick={clearNews}
				>Mark all as seen</button
			>
		</div>
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
						<div class="min-w-0">
							<p class="text-lg font-semibold group-hover:text-accent">{n.title}</p>
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

<!-- overflow-y-hidden: overflow-x alone makes the row scroll vertically too, and the tabs hang 1px
	below it (-mb-px) so a scrollbar showed beside them. -->
<nav
	class="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line"
	aria-label="Watch lists"
>
	{#each WATCH_STATUSES as s (s)}
		<a
			href="/?tab={s}"
			aria-current={data.tab === s ? 'page' : undefined}
			class="-mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-[3px] px-3 text-base font-semibold whitespace-nowrap {data.tab ===
			s
				? 'border-accent text-ink'
				: 'border-transparent text-ink-2 hover:text-ink'}"
			>{STATUS_LABEL[s]}
			<span class="font-normal text-muted">{data.counts[s]}</span></a
		>
	{/each}
</nav>

{#if !data.titles.length}
	<div class="flex flex-col items-center gap-2 card px-6 py-16 text-center">
		<p class="font-serif text-lg font-semibold">Nothing here yet</p>
		<p class="max-w-sm text-sm text-ink-2">{empty[data.tab]}</p>
	</div>
{:else}
	<!-- One title a row, with room for the details (the owner chose the Editorial design, #1). -->
	<ul class="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.titles as t (`${t.media}-${t.tmdbId}`)}
			<li class="border-b border-line">
				<a href={titleHref(t)} class="group flex items-center gap-4 py-4">
					<Poster
						title={t.title}
						path={t.posterPath}
						size="w185"
						showTitle={false}
						class="w-16 shrink-0 group-hover:ring-2 group-hover:ring-accent"
					/>
					<div class="min-w-0 flex-1">
						<h2 class="line-clamp-2 text-lg leading-snug font-semibold group-hover:text-accent">
							{t.title}
						</h2>
						<p class="mt-0.5 text-sm text-ink-2">
							{t.media === 'tv' ? 'Series' : 'Film'}{#if t.year}&nbsp;· {t.year}{/if}{#if t.rating}&nbsp;·
								yours {t.rating}/10{/if}{#if t.imdb}&nbsp;· IMDb {t.imdb.rating.toFixed(1)}{/if}
						</p>
						{#if t.media === 'tv' && t.seenEpisodes}
							<p class="mt-0.5 text-sm text-ink-2">
								{progressLabel(t.seenEpisodes, t.episodes)} watched
							</p>
						{/if}
						{#if data.tab === 'watching' && t.nextEpisode}
							<p class="mt-0.5 text-sm text-ink-2">
								Next: {episodeLabel(t.nextEpisode)}{#if t.nextEpisode.airDate},<span
										class="whitespace-nowrap">&nbsp;{formatAirDate(t.nextEpisode.airDate)}</span
									>{/if}
							</p>
						{/if}
						{#if t.onMine.length}
							<div
								class="mt-1.5 flex items-center gap-1"
								role="group"
								aria-label="On your services"
							>
								{#each t.onMine as p (p.id)}<ProviderLogo provider={p} class="size-6" />{/each}
							</div>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<label class="mt-10 flex items-start gap-2 text-sm text-ink-2">
	<input
		type="checkbox"
		class="mt-0.5 size-4 accent-[var(--accent)]"
		checked={emailNews}
		onchange={(e) => setEmail((e.currentTarget as HTMLInputElement).checked)}
	/>
	<span
		>Email me when a series I am watching has a new episode, or a film I want to watch comes out.
		{#if saveFailed}<span class="text-heart" role="alert">Could not save, try again.</span
			>{/if}</span
	>
</label>

{#if data.services.length}<JustWatchCredit />{/if}
<TmdbCredit demo={data.demo} />
