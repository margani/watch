<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Poster from '#lib/components/Poster.svelte';
	import TmdbCredit from '#lib/components/TmdbCredit.svelte';
	import { titleHref, type TitleHit } from '#lib/watch.ts';
	import {
		groupViewings,
		netflixViewings,
		type FilmSeen,
		type SeriesSeen
	} from '#lib/watch-import.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface Row {
		key: string;
		media: 'movie' | 'tv';
		name: string;
		seen: string;
		film?: FilmSeen;
		series?: SeriesSeen;
		match: TitleHit | null | undefined;
		include: boolean;
		result?: string;
	}

	let rows = $state<Row[]>([]);
	let phase = $state<'pick' | 'matching' | 'review' | 'adding' | 'done'>('pick');
	let problem = $state<string | null>(null);
	let progress = $state(0);

	const episodeCount = (s: SeriesSeen) =>
		Object.values(s.seasons).reduce((n, e) => n + e.length, 0);

	async function read(file: File) {
		problem = null;
		const views = netflixViewings(await file.text());
		if (!views.length) {
			problem = 'This does not look like Netflix’s viewing activity: no "Title" column was found.';
			return;
		}
		const { series, films } = groupViewings(views);
		rows = [
			...series.map((s) => ({
				key: `tv:${s.name}`,
				media: 'tv' as const,
				name: s.name,
				seen: `${episodeCount(s)} ${episodeCount(s) === 1 ? 'episode' : 'episodes'}`,
				series: s,
				match: undefined,
				include: true
			})),
			...films.map((f) => ({
				key: `movie:${f.title}`,
				media: 'movie' as const,
				name: f.title,
				seen: f.date ?? '',
				film: f,
				match: undefined,
				include: true
			}))
		];
		phase = 'matching';
		progress = 0;
		// Twenty names a request, so a long history stays within what one Worker request may ask TMDB.
		for (let i = 0; i < rows.length; i += 20) {
			const chunk = rows.slice(i, i + 20);
			try {
				const res = await fetch('/api/import/match', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ items: chunk.map((r) => ({ media: r.media, name: r.name })) })
				});
				if (!res.ok) throw new Error(String(res.status));
				const { matches } = (await res.json()) as { matches: (TitleHit | null)[] };
				chunk.forEach((r, j) => {
					r.match = matches[j];
					r.include = !!matches[j];
				});
			} catch {
				chunk.forEach((r) => {
					r.match = null;
					r.include = false;
				});
				problem = 'Some titles could not be looked up; they are left out below.';
			}
			progress = Math.min(rows.length, i + 20);
		}
		phase = 'review';
	}

	async function add() {
		phase = 'adding';
		progress = 0;
		const chosen = rows.filter((r) => r.include && r.match);
		for (const r of chosen) {
			const m = r.match!;
			const body =
				r.media === 'movie'
					? { media: 'movie', tmdbId: m.tmdbId, date: r.film?.date }
					: {
							media: 'tv',
							tmdbId: m.tmdbId,
							seasons: Object.entries(r.series!.seasons).map(([season, eps]) => ({
								season: Number(season),
								names: eps.map((e) => e.name)
							}))
						};
			try {
				const res = await fetch('/api/import/apply', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!res.ok) throw new Error(String(res.status));
				const out = (await res.json()) as { episodes?: number; unmatched?: number };
				r.result =
					r.media === 'movie'
						? 'Added as watched'
						: `${out.episodes} episodes ticked${out.unmatched ? `, ${out.unmatched} not found` : ''}`;
			} catch {
				r.result = 'Could not add';
			}
			progress++;
		}
		phase = 'done';
	}

	const chosenCount = $derived(rows.filter((r) => r.include && r.match).length);
</script>

<svelte:head><title>Import viewing history · Watch</title></svelte:head>

<a href="/" class="mb-4 inline-block text-sm text-ink-2 hover:text-ink">← Films and series</a>

<h1 class="mb-2 font-serif text-2xl font-semibold sm:text-3xl">Import viewing history</h1>

<section class="mb-6 max-w-prose text-sm text-ink-2">
	<p class="mb-2">
		From Netflix: on the website open <span class="font-medium text-ink">Account</span> →
		<span class="font-medium text-ink">Profiles</span>, choose your profile, open
		<span class="font-medium text-ink">Viewing activity</span>, then
		<span class="font-medium text-ink">Download all</span> at the bottom. Choose that file here.
	</p>
	<p>
		The file is read in this browser. Only the titles go to the server to be matched, and nothing
		else from it is kept.
		<a
			href="https://help.netflix.com/en/node/101917"
			class="inline-flex items-center gap-1 text-accent hover:underline"
			rel="noopener noreferrer">Netflix help <ExternalLink class="size-3" aria-hidden="true" /></a
		>
	</p>
</section>

{#if phase === 'pick'}
	<label class="flex max-w-sm flex-col gap-1 text-sm text-ink-2">
		Netflix viewing activity (CSV)
		<input
			type="file"
			accept=".csv,text/csv"
			class="field h-auto py-2 text-ink"
			onchange={(e) => {
				const f = (e.currentTarget as HTMLInputElement).files?.[0];
				if (f) read(f);
			}}
		/>
	</label>
{/if}

{#if problem}<p class="mt-3 text-sm text-heart" role="alert">{problem}</p>{/if}

{#if phase === 'matching'}
	<p class="text-sm text-ink-2" role="status">Looking up titles: {progress} of {rows.length}…</p>
{/if}

{#if phase === 'review' || phase === 'adding' || phase === 'done'}
	<div class="mb-3 flex flex-wrap items-center gap-3">
		{#if phase === 'review'}
			<button type="button" class="btn-primary h-10" disabled={!chosenCount} onclick={add}
				>Add {chosenCount} to my list</button
			>
			<p class="text-sm text-ink-2">Untick anything matched to the wrong title.</p>
		{:else if phase === 'adding'}
			<p class="text-sm text-ink-2" role="status">Adding: {progress} of {chosenCount}…</p>
		{:else}
			<p class="text-sm font-medium" role="status">Done.</p>
			<a href="/" class="btn-ghost h-9">Open my list</a>
		{/if}
	</div>
	<ul class="flex flex-col gap-2" aria-label="Titles found">
		{#each rows as r (r.key)}
			<li class="flex items-center gap-3 card px-3 py-2">
				<input
					type="checkbox"
					class="size-4 shrink-0 accent-[var(--accent)]"
					bind:checked={r.include}
					disabled={!r.match || phase !== 'review'}
					aria-label="Add {r.name}"
				/>
				{#if r.match}
					<Poster
						title={r.match.title}
						path={r.match.posterPath}
						size="w185"
						showTitle={false}
						class="w-9 shrink-0"
					/>
				{/if}
				<div class="min-w-0 flex-1 text-sm">
					<p class="truncate font-medium">{r.name}</p>
					<p class="truncate text-xs text-muted">
						{r.media === 'tv' ? 'Series' : 'Film'}{#if r.seen}&nbsp;· {r.seen}{/if}
						{#if r.match}
							→ <a href={titleHref(r.match)} class="text-ink-2 hover:text-ink"
								>{r.match.title}{#if r.match.year}&nbsp;({r.match.year}){/if}</a
							>
						{:else}
							· not found
						{/if}
					</p>
				</div>
				{#if r.result}<span class="shrink-0 text-xs text-ink-2">{r.result}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

<TmdbCredit demo={data.demo} />
