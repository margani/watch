<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Check from '@lucide/svelte/icons/check';
	import Poster from '#lib/components/Poster.svelte';
	import { titleHref, type TitleHit } from '#lib/watch.ts';

	interface Props {
		heading: string;
		titles: (TitleHit & { note?: string; imdb?: { rating: number; votes: number } | null })[];
	}
	let { heading, titles }: Props = $props();
	let added = $state<Record<string, 'saving' | 'added' | 'failed'>>({});

	// One tap puts a suggestion on the viewer's "want to watch" list.
	async function want(t: TitleHit) {
		const key = `${t.media}-${t.tmdbId}`;
		added[key] = 'saving';
		const res = await fetch(`/api/${t.media}/${t.tmdbId}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: 'want' })
		}).catch(() => null);
		added[key] = res?.ok ? 'added' : 'failed';
	}
</script>

{#if titles.length}
	<section class="mb-8" aria-label={heading}>
		<h2 class="mb-3 font-serif text-lg font-semibold">{heading}</h2>
		<!-- One row that scrolls sideways, so four rows of twelve stay short on a phone; overflow-y
			hidden or the row also scrolls up and down. -->
		<ul class="-mx-1 flex snap-x gap-4 overflow-x-auto overflow-y-hidden px-1 pb-2">
			{#each titles as t (`${t.media}-${t.tmdbId}`)}
				{@const state = added[`${t.media}-${t.tmdbId}`]}
				<li class="flex w-32 shrink-0 snap-start flex-col gap-2 sm:w-40">
					<a href={titleHref(t)} class="group flex flex-col gap-2">
						<Poster
							title={t.title}
							path={t.posterPath}
							class="group-hover:ring-2 group-hover:ring-accent"
						/>
						<div>
							<h3 class="line-clamp-2 text-sm leading-snug font-semibold group-hover:text-accent">
								{t.title}
							</h3>
							<p class="text-xs text-muted">
								{t.media === 'tv' ? 'Series' : 'Film'}{#if t.year}&nbsp;· {t.year}{/if}
							</p>
							{#if t.imdb}
								<p class="mt-0.5 text-xs">
									<span class="font-semibold">IMDb {t.imdb.rating.toFixed(1)}</span>
								</p>
							{/if}
							{#if t.note}<p class="mt-0.5 text-xs text-ink-2">{t.note}</p>{/if}
						</div>
					</a>
					<button
						type="button"
						class="btn-ghost h-8 self-start px-2.5 text-xs"
						disabled={state === 'saving' || state === 'added'}
						onclick={() => want(t)}
						aria-label="Want to watch {t.title}"
					>
						{#if state === 'added'}<Check class="size-3.5" aria-hidden="true" /> On my list{:else}<Plus
								class="size-3.5"
								aria-hidden="true"
							/> Want to watch{/if}
					</button>
					{#if state === 'failed'}<p class="text-xs text-heart" role="alert">Could not add.</p>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
