<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import {
		formatAirDate,
		hasAired,
		progressLabel,
		type SeasonEpisode,
		type WatchStatus
	} from '#lib/watch.ts';

	interface Props {
		tmdbId: number;
		seasons: number;
		episodes: number | null;
		/** "season:episode" keys the viewer has seen. */
		watched: string[];
		/** Told when ticking moved the series to another status. */
		onstatus?: (status: WatchStatus | null) => void;
	}
	let { tmdbId, seasons, episodes, watched, onstatus }: Props = $props();

	// The server's list, then whatever the last save returned.
	let saved = $state<string[] | null>(null);
	const seen = $derived(new Set(saved ?? watched));
	const today = new Date().toISOString().slice(0, 10);
	let lists = $state<Record<number, SeasonEpisode[] | 'loading' | 'failed'>>({});
	let busy = $state(false);
	let failed = $state(false);

	async function open(n: number) {
		if (lists[n] && lists[n] !== 'failed') return;
		lists[n] = 'loading';
		try {
			const res = await fetch(`/api/tv/${tmdbId}/season/${n}`);
			if (!res.ok) throw new Error(String(res.status));
			lists[n] = ((await res.json()) as { episodes: SeasonEpisode[] }).episodes;
		} catch {
			lists[n] = 'failed';
		}
	}

	async function mark(season: number, numbers: number[], value: boolean) {
		if (busy || !numbers.length) return;
		busy = true;
		failed = false;
		try {
			const res = await fetch(`/api/tv/${tmdbId}/episodes`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ season, episodes: numbers, seen: value })
			});
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { watched: string[]; status: WatchStatus | null };
			saved = body.watched;
			onstatus?.(body.status);
		} catch {
			failed = true;
		} finally {
			busy = false;
		}
	}

	const seenIn = (n: number) => [...seen].filter((k) => k.startsWith(`${n}:`)).length;
	const progress = $derived(progressLabel(seen.size, episodes));
</script>

<section class="mt-6" aria-labelledby="episodes-heading">
	<div class="mb-2 flex flex-wrap items-baseline gap-x-3">
		<h2 id="episodes-heading" class="text-sm font-semibold">Episodes</h2>
		<p class="text-sm text-ink-2">{progress ? `${progress} watched` : 'None watched yet'}</p>
	</div>
	{#if failed}<p class="mb-2 text-sm text-heart" role="alert">Could not save, try again.</p>{/if}
	<div class="flex flex-col gap-2">
		{#each Array.from({ length: seasons }, (_, i) => i + 1) as n (n)}
			{@const list = lists[n]}
			<details
				class="card"
				ontoggle={(e) => (e.currentTarget as HTMLDetailsElement).open && open(n)}
			>
				<summary class="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm">
					<span class="font-medium">Season {n}</span>
					{#if seenIn(n)}<span class="text-muted">{seenIn(n)} watched</span>{/if}
				</summary>
				<div class="border-t border-line px-4 py-3">
					{#if list === 'loading' || list === undefined}
						<p class="text-sm text-muted">Loading episodes…</p>
					{:else if list === 'failed'}
						<p class="text-sm text-heart">
							Could not load this season. <button
								type="button"
								class="underline"
								onclick={() => open(n)}>Try again</button
							>
						</p>
					{:else}
						{@const aired = list.filter((e) => hasAired(e, today))}
						{@const allSeen = aired.length > 0 && aired.every((e) => seen.has(`${n}:${e.number}`))}
						<button
							type="button"
							class="btn-ghost mb-2 h-8 text-xs"
							disabled={busy || !aired.length}
							onclick={() =>
								mark(
									n,
									aired.map((e) => e.number),
									!allSeen
								)}>{allSeen ? 'Mark season as not watched' : 'Mark season as watched'}</button
						>
						<ul class="flex flex-col" aria-label="Season {n} episodes">
							{#each list as e (e.number)}
								{@const key = `${n}:${e.number}`}
								{@const out = hasAired(e, today)}
								<li>
									<label
										class="flex items-start gap-3 py-1.5 text-sm {out
											? 'cursor-pointer'
											: 'text-muted'}"
									>
										<input
											type="checkbox"
											class="mt-0.5 size-4 accent-[var(--accent)]"
											checked={seen.has(key)}
											disabled={busy || !out}
											onchange={(ev) =>
												mark(n, [e.number], (ev.currentTarget as HTMLInputElement).checked)}
										/>
										<span class="min-w-0 flex-1"
											><span class="text-muted">{e.number}.</span>
											{e.name || `Episode ${e.number}`}{#if seen.has(key)}<Check
													class="ml-1 inline size-3.5 text-accent"
													aria-hidden="true"
												/>{/if}</span
										>
										{#if e.airDate}<span class="shrink-0 text-xs whitespace-nowrap text-muted"
												>{out ? '' : 'Out '}{formatAirDate(e.airDate)}</span
											>{/if}
									</label>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</details>
		{/each}
	</div>
</section>
