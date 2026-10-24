<script lang="ts">
	import CastPhoto from '#lib/components/CastPhoto.svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Episodes from '#lib/components/Episodes.svelte';
	import JustWatchCredit from '#lib/components/JustWatchCredit.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import ProviderLogo from '#lib/components/ProviderLogo.svelte';
	import TmdbCredit from '#lib/components/TmdbCredit.svelte';
	import TrailerPlayer from '#lib/components/TrailerPlayer.svelte';
	import {
		episodeLabel,
		formatAirDate,
		formatRuntime,
		RATING_MAX,
		serviceLink,
		ownLinkHref,
		personHref,
		STATUS_LABEL,
		type Credit,
		WATCH_STATUSES,
		type WatchStatus
	} from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const d = $derived(data.details);
	// Copies stored before #20 have the names only.
	const makers = $derived<Credit[]>(d.makerCredits ?? d.makers.map((name) => ({ id: null, name })));
	const links = $derived(
		data.links
			.map((l) => ({ name: l.name, href: ownLinkHref(l, d) }))
			.filter((l): l is { name: string; href: string } => l.href !== null)
	);

	// What the server said, overridden by the viewer's last change once it has been saved.
	let saved = $state<{ status: WatchStatus | null; rating: number | null } | null>(null);
	const status = $derived(saved ? saved.status : (data.entry?.status ?? null));
	const rating = $derived(saved ? saved.rating : (data.entry?.rating ?? null));
	let busy = $state(false);
	let failed = $state(false);

	async function send(body: { status?: WatchStatus; rating?: number | null } | null) {
		if (busy) return;
		busy = true;
		failed = false;
		try {
			const res = await fetch(`/api/${d.media}/${d.tmdbId}`, {
				method: body ? 'PUT' : 'DELETE',
				headers: body ? { 'content-type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			if (!res.ok) throw new Error(String(res.status));
			saved = body ? await res.json() : { status: null, rating: null };
		} catch {
			failed = true;
		} finally {
			busy = false;
		}
	}

	const facts = $derived(
		[
			d.media === 'tv' ? 'Series' : 'Film',
			d.year,
			formatRuntime(d.runtime) &&
				(d.media === 'tv' ? `${formatRuntime(d.runtime)} an episode` : formatRuntime(d.runtime)),
			d.seasons ? `${d.seasons} ${d.seasons === 1 ? 'season' : 'seasons'}` : null,
			d.episodes ? `${d.episodes} episodes` : null,
			d.status
		].filter(Boolean)
	);
</script>

{#snippet people(list: Credit[])}
	{#each list as m, i (i)}{#if i},
		{/if}{#if m.id}<a
				href={personHref(m.id)}
				class="underline-offset-2 hover:text-accent hover:underline">{m.name}</a
			>{:else}{m.name}{/if}{/each}
{/snippet}

<svelte:head><title>{d.title} · Watch</title></svelte:head>

<a href="/" class="mb-4 inline-block text-sm text-ink-2 hover:text-ink">← Films and series</a>

<article class="grid gap-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8">
	<Poster title={d.title} path={d.posterPath} size="w500" class="mx-auto w-44 sm:w-full" eager />

	<div class="min-w-0">
		<h1 class="font-serif text-2xl leading-tight font-semibold sm:text-3xl">{d.title}</h1>
		{#if d.originalTitle && d.originalTitle !== d.title}
			<p class="text-sm text-muted">{d.originalTitle}</p>
		{/if}
		<p class="mt-1 text-sm text-ink-2">{facts.join(' · ')}</p>
		{#if d.genres.length}<p class="mt-1 text-xs text-muted">{d.genres.join(', ')}</p>{/if}
		{#if data.imdb}
			<p class="mt-2 text-sm">
				<span class="font-semibold">{data.imdb.rating.toFixed(1)}</span><span class="text-muted"
					>/10 on IMDb, {data.imdb.votes.toLocaleString('en-GB')} votes</span
				>
			</p>
		{/if}
		{#if data.otherRatings.length}
			<p class="mt-0.5 text-sm text-ink-2">
				{#each data.otherRatings as r, i (r.source)}{#if i}&nbsp;·
					{/if}{r.source}
					<span class="font-semibold text-ink">{r.value}</span>{/each}
			</p>
		{/if}
		{#if d.rating}
			<p class="{data.imdb || data.otherRatings.length ? 'mt-0.5' : 'mt-2'} text-sm">
				<span class="font-semibold">{d.rating.toFixed(1)}</span><span class="text-muted"
					>/10 on TMDB{#if d.ratingCount}, {d.ratingCount.toLocaleString('en-GB')} votes{/if}</span
				>
			</p>
		{/if}

		{#if d.trailer}<TrailerPlayer trailer={d.trailer} title={d.title} />{/if}

		<section class="mt-5 sm:max-w-md" aria-label="My list">
			<!-- One segmented control on one line: the main thing done on this page, without a card
			     around it (#17). -->
			<div
				class="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1"
				role="group"
				aria-label="Status"
			>
				{#each WATCH_STATUSES as s (s)}
					<button
						type="button"
						class="h-11 rounded-full px-2 text-sm font-medium whitespace-nowrap text-ink-2 transition-colors hover:text-ink disabled:opacity-60 aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:shadow-sm sm:text-base"
						aria-pressed={status === s}
						disabled={busy}
						onclick={() => send({ status: s })}>{STATUS_LABEL[s]}</button
					>
				{/each}
			</div>
			{#if status}
				<div class="mt-1 flex items-center justify-between gap-3 px-1">
					<label class="flex items-center gap-1 text-sm text-ink-2">
						My rating
						<select
							class="h-11 cursor-pointer rounded-lg bg-transparent px-1 text-sm font-medium text-ink hover:bg-surface-2"
							value={rating ?? ''}
							disabled={busy}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								send({ rating: v ? Number(v) : null });
							}}
						>
							<option value="">None</option>
							{#each Array.from({ length: RATING_MAX }, (_, i) => RATING_MAX - i) as n (n)}
								<option value={n}>{n}/10</option>
							{/each}
						</select>
					</label>
					<button
						type="button"
						class="h-11 px-1 text-sm text-ink-2 hover:text-ink hover:underline"
						disabled={busy}
						onclick={() => send(null)}>Remove from my list</button
					>
				</div>
			{/if}
			{#if failed}<p class="mt-2 text-sm text-heart" role="alert">
					Could not save, try again.
				</p>{/if}
		</section>

		<section class="mt-4 text-sm" aria-labelledby="where-heading">
			<h2 id="where-heading" class="mb-2 font-semibold">Where to watch</h2>
			{#if !data.country}
				<p class="text-ink-2">
					<a href="/services" class="text-accent hover:underline"
						>Choose your country and services</a
					> to see where this streams.
				</p>
			{:else if !data.where || !(data.where.mine.length || data.where.others.length || data.where.rent.length || data.where.buy.length)}
				<p class="text-ink-2">Not streaming, to rent or to buy where you are, as far as we know.</p>
			{:else}
				{#if data.where.mine.length}
					<div class="mb-2 flex flex-wrap items-center gap-2">
						<span class="font-medium text-accent">On your services</span>
						{#each data.where.mine as p (p.id)}
							{@const href = serviceLink(p, d.title, data.where.link)}
							{#if href}
								<a
									{href}
									class="inline-flex items-center gap-1.5 hover:text-accent hover:underline"
									rel="noopener noreferrer"
									><ProviderLogo provider={p} class="size-7" decorative />{p.name}</a
								>
							{:else}
								<span class="inline-flex items-center gap-1.5"
									><ProviderLogo provider={p} class="size-7" decorative />{p.name}</span
								>
							{/if}
						{/each}
					</div>
				{:else if data.hasServices}
					<p class="mb-2 text-ink-2">Not on any of your services.</p>
				{/if}
				{#each [['Also streaming', data.where.others], ['Rent', data.where.rent], ['Buy', data.where.buy]] as const as [label, list] (label)}
					{#if list.length}
						<div class="mb-1.5 flex flex-wrap items-center gap-1.5">
							<span class="w-28 shrink-0 text-muted">{label}</span>
							{#each list as p, i (`${p.id}-${i}`)}
								{@const href = serviceLink(p, d.title, data.where.link)}
								{#if href}<a
										{href}
										class="rounded-md hover:ring-2 hover:ring-accent"
										rel="noopener noreferrer"
										aria-label="{p.name}: {d.title}"
										><ProviderLogo provider={p} class="size-6" decorative /></a
									>{:else}<ProviderLogo provider={p} class="size-6" />{/if}
							{/each}
						</div>
					{/if}
				{/each}
				{#if data.where.link}
					<a
						href={data.where.link}
						class="mt-1 inline-flex items-center gap-1 text-ink-2 hover:text-ink"
						rel="noopener noreferrer"
						>Links to each service <ExternalLink class="size-3.5" aria-hidden="true" /></a
					>
				{/if}
				<JustWatchCredit />
			{/if}
			{#if links.length}
				<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Your links">
					{#each links as l, i (i)}
						<li>
							<a
								href={l.href}
								class="inline-flex items-center gap-1 text-accent hover:underline"
								rel="noopener noreferrer"
								>{l.name} <ExternalLink class="size-3.5" aria-hidden="true" /></a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.stale}
			<p class="mt-3 text-xs text-muted">
				TMDB is not answering; these are the details kept from earlier.
			</p>
		{/if}
		{#if d.tagline}<p class="mt-5 font-serif text-lg text-ink-2 italic">{d.tagline}</p>{/if}
		{#if d.overview}<p class="mt-3 leading-relaxed">{d.overview}</p>{/if}

		{#if d.media === 'tv' && (d.nextEpisode || d.lastEpisode)}
			<dl class="mt-5 grid gap-1 text-sm">
				{#if d.nextEpisode}
					<div class="flex gap-2">
						<dt class="text-muted">Next</dt>
						<dd>
							{episodeLabel(d.nextEpisode)}{#if d.nextEpisode.airDate},<span
									class="whitespace-nowrap">&nbsp;{formatAirDate(d.nextEpisode.airDate)}</span
								>{/if}
						</dd>
					</div>
				{/if}
				{#if d.lastEpisode}
					<div class="flex gap-2">
						<dt class="text-muted">Latest</dt>
						<dd>
							{episodeLabel(d.lastEpisode)}{#if d.lastEpisode.airDate},<span
									class="whitespace-nowrap">&nbsp;{formatAirDate(d.lastEpisode.airDate)}</span
								>{/if}
						</dd>
					</div>
				{/if}
			</dl>
		{/if}

		{#if d.media === 'tv' && d.seasons}
			<Episodes
				tmdbId={d.tmdbId}
				seasons={d.seasons}
				episodes={d.episodes}
				watched={data.watchedEpisodes}
				onstatus={(s) => (saved = { status: s, rating })}
			/>
		{/if}

		{#if makers.length || d.music?.length}
			<dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
				{#if makers.length}
					<dt class="text-muted">{d.media === 'tv' ? 'Created by' : 'Directed by'}</dt>
					<dd>{@render people(makers)}</dd>
				{/if}
				{#if d.music?.length}
					<dt class="text-muted">Music by</dt>
					<dd>{@render people(d.music)}</dd>
				{/if}
			</dl>
		{/if}
		{#if d.cast.length}
			<h2 class="mt-5 mb-2 text-sm font-semibold">Cast</h2>
			<ul class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
				{#each d.cast as c, i (i)}
					<li>
						<svelte:element
							this={c.id ? 'a' : 'div'}
							href={c.id ? personHref(c.id) : undefined}
							class="group flex items-center gap-3"
						>
							<CastPhoto name={c.name} path={c.profilePath} />
							<span class="min-w-0">
								<span class="block font-medium {c.id ? 'group-hover:text-accent' : ''}"
									>{c.name}</span
								>
								{#if c.role}<span class="block text-muted">{c.role}</span>{/if}
							</span>
						</svelte:element>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-6 flex flex-wrap gap-3 text-sm">
			{#if !data.demo}
				<a
					href="https://www.themoviedb.org/{d.media}/{d.tmdbId}"
					class="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
					rel="noopener noreferrer">TMDB <ExternalLink class="size-3.5" aria-hidden="true" /></a
				>
			{/if}
			{#if d.imdbId}
				<a
					href="https://www.imdb.com/title/{d.imdbId}/"
					class="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
					rel="noopener noreferrer">IMDb <ExternalLink class="size-3.5" aria-hidden="true" /></a
				>
			{/if}
		</div>
	</div>
</article>

<TmdbCredit demo={data.demo} />
