<script lang="ts">
	import CastPhoto from '#lib/components/CastPhoto.svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Poster from '#lib/components/Poster.svelte';
	import DemoNote from '#lib/components/DemoNote.svelte';
	import {
		formatAirDate,
		PERSON_KIND_LABEL,
		STATUS_LABEL,
		titleHref,
		type PersonKind
	} from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.person);

	let picked = $state<PersonKind | null>(null);
	const kind = $derived(picked ?? data.open);
	let order = $state<'known' | 'newest'>('known');
	let fullBio = $state(false);

	const shown = $derived(
		p.credits
			.filter((c) => c.kind === kind)
			.sort((a, b) => (order === 'known' ? b.votes - a.votes : (b.year ?? 9999) - (a.year ?? 9999)))
	);
	const lived = $derived(
		[
			p.birthday && `Born ${formatAirDate(p.birthday)}`,
			p.deathday && `died ${formatAirDate(p.deathday)}`,
			p.placeOfBirth && `in ${p.placeOfBirth}`
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<svelte:head><title>{p.name} · Watch</title></svelte:head>

<div class="flex items-center gap-4">
	<CastPhoto name={p.name} path={p.profilePath} size="lg" />
	<div class="min-w-0">
		<h1 class="font-serif text-2xl leading-tight font-semibold sm:text-3xl">{p.name}</h1>
		{#if lived}<p class="mt-1 text-sm text-ink-2">{lived}</p>{/if}
	</div>
</div>

{#if p.biography}
	<div class="mt-4 max-w-prose text-sm leading-relaxed text-ink-2">
		<p class="whitespace-pre-line {fullBio ? '' : 'line-clamp-4'}">{p.biography}</p>
		{#if p.biography.length > 320}
			<button
				type="button"
				class="mt-1 h-11 text-sm font-medium text-accent hover:underline"
				aria-expanded={fullBio}
				onclick={() => (fullBio = !fullBio)}>{fullBio ? 'Less' : 'More'}</button
			>
		{/if}
	</div>
{/if}

{#if kind}
	<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
		{#if data.kinds.length > 1}
			<div class="flex gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Work">
				{#each data.kinds as k (k)}
					<button
						type="button"
						class="h-10 rounded-full px-4 text-sm font-medium text-ink-2 hover:text-ink aria-pressed:bg-accent aria-pressed:text-accent-ink"
						aria-pressed={kind === k}
						onclick={() => (picked = k)}
						>{PERSON_KIND_LABEL[k]}
						<span class="font-normal opacity-80"
							>{p.credits.filter((c) => c.kind === k).length}</span
						></button
					>
				{/each}
			</div>
		{:else}
			<h2 class="text-sm font-semibold">
				{PERSON_KIND_LABEL[kind]} <span class="font-normal text-ink-2">{shown.length}</span>
			</h2>
		{/if}
		<label class="flex items-center gap-1 text-sm text-ink-2">
			Order
			<select
				class="h-11 cursor-pointer rounded-lg bg-transparent px-1 text-sm font-medium text-ink hover:bg-surface-2"
				bind:value={order}
			>
				<option value="known">Best known</option>
				<option value="newest">Newest</option>
			</select>
		</label>
	</div>

	<ul class="mt-3 grid gap-x-6 sm:grid-cols-2" aria-label={PERSON_KIND_LABEL[kind]}>
		{#each shown as c (`${c.media}-${c.tmdbId}`)}
			<li class="border-b border-line">
				<a href={titleHref(c)} class="group flex items-center gap-3 py-3">
					<Poster
						title={c.title}
						path={c.posterPath}
						size="w185"
						showTitle={false}
						class="w-12 shrink-0"
					/>
					<span class="min-w-0 flex-1">
						<span class="block leading-snug font-semibold group-hover:text-accent">{c.title}</span>
						<span class="block text-xs text-muted">
							{c.media === 'tv' ? 'Series' : 'Film'}{#if c.year}&nbsp;· {c.year}{/if}{#if c.imdb}&nbsp;·
								<span class="font-semibold text-ink">IMDb {c.imdb.rating.toFixed(1)}</span>{/if}
						</span>
						{#if c.role}<span class="block truncate text-xs text-ink-2">{c.role}</span>{/if}
					</span>
					{#if c.status}
						<span
							class="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
							>{STATUS_LABEL[c.status]}</span
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-6 card px-6 py-12 text-center text-sm text-ink-2">
		No films or series listed for {p.name}.
	</p>
{/if}

{#if !data.demo}
	<p class="mt-6 text-sm">
		<a
			href="https://www.themoviedb.org/person/{p.id}"
			class="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
			rel="noopener noreferrer">TMDB <ExternalLink class="size-3.5" aria-hidden="true" /></a
		>
	</p>
{/if}

<DemoNote demo={data.demo} />
