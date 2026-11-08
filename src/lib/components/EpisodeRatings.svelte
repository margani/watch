<script lang="ts">
	import {
		RATING_BANDS,
		ratingBand,
		type RatingBand,
		type RatingsMatrix
	} from '#lib/episode-ratings.ts';

	let { matrix }: { matrix: RatingsMatrix } = $props();

	// Whole class names, so Tailwind finds them. Each pair keeps at least 5:1 in every theme.
	const COLOURS: Record<RatingBand, string> = {
		awesome: 'bg-rating-awesome text-rating-awesome-ink',
		great: 'bg-rating-great text-rating-great-ink',
		good: 'bg-rating-good text-rating-good-ink',
		average: 'bg-rating-average text-rating-average-ink',
		bad: 'bg-rating-bad text-rating-bad-ink',
		garbage: 'bg-rating-garbage text-rating-garbage-ink'
	};
	const SWATCHES: Record<RatingBand, string> = {
		awesome: 'bg-rating-awesome',
		great: 'bg-rating-great',
		good: 'bg-rating-good',
		average: 'bg-rating-average',
		bad: 'bg-rating-bad',
		garbage: 'bg-rating-garbage'
	};
</script>

<section class="mt-6">
	<h2 id="episode-ratings-heading" class="mb-2 text-sm font-semibold">Episode ratings on IMDb</h2>
	<ul class="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2" aria-label="Colours">
		{#each RATING_BANDS as b (b.band)}
			<li class="inline-flex items-center gap-1">
				<span class="size-2.5 rounded-full {SWATCHES[b.band]}" aria-hidden="true"></span>{b.label}
			</li>
		{/each}
	</ul>
	<!-- A long series is wider than a phone: the episode numbers stay put while the seasons scroll. -->
	<!-- relative: sr-only labels are absolutely placed, and without a positioned ancestor here they
	     escape the scrolling box and made a 30-season page 787 px wider than the phone. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="relative overflow-x-auto pb-1"
		tabindex="0"
		role="region"
		aria-labelledby="episode-ratings-heading"
	>
		<table class="border-separate border-spacing-0.5 text-xs tabular-nums">
			<thead>
				<tr>
					<td class="sticky left-0 bg-bg"></td>
					{#each matrix.seasons as s (s)}
						<th scope="col" class="px-1 pb-0.5 font-medium text-muted">
							<span aria-hidden="true">S{s}</span><span class="sr-only">Season {s}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each matrix.rows as row (row.episode)}
					<tr>
						<th scope="row" class="sticky left-0 bg-bg pr-1 text-right font-medium text-muted">
							<span aria-hidden="true">E{row.episode}</span><span class="sr-only"
								>Episode {row.episode}</span
							>
						</th>
						{#each row.cells as c, i (matrix.seasons[i])}
							<td class="p-0">
								{#if c}
									{@const info = `Season ${c.season}, episode ${c.episode}: ${c.rating.toFixed(1)} on IMDb, ${c.votes.toLocaleString('en-GB')} votes`}
									<a
										href="https://www.imdb.com/title/{c.imdbId}/"
										rel="noopener noreferrer"
										title={info}
										aria-label={info}
										class="flex h-7 w-9 items-center justify-center rounded-md font-semibold {COLOURS[
											ratingBand(c.rating)
										]}">{c.rating.toFixed(1)}</a
									>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row" class="sticky left-0 bg-bg pt-1 pr-1 text-right font-medium text-muted">
						<span aria-hidden="true">Avg</span><span class="sr-only">Season average</span>
					</th>
					{#each matrix.averages as a, i (matrix.seasons[i])}
						<td class="pt-1 text-center font-semibold text-ink">{a.toFixed(1)}</td>
					{/each}
				</tr>
			</tfoot>
		</table>
	</div>
	<p class="mt-1 text-xs text-muted">Episodes with at least 100 votes.</p>
</section>
