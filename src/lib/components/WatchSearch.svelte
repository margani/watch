<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import { goto } from '$app/navigation';
	import Poster from './Poster.svelte';
	import { STATUS_LABEL, titleHref, type Suggestion } from '#lib/watch.ts';

	interface Props {
		q?: string;
		autofocus?: boolean;
	}
	let { q = '', autofocus = false }: Props = $props();

	// Suggestions while typing (#28). Asking on every key would send a request per letter and make
	// the list jump under the fingers; asking once typing pauses is both calmer and cheaper.
	const PAUSE_MS = 300;
	const MIN_CHARS = 2;

	const id = $props.id();
	// svelte-ignore state_referenced_locally
	let value = $state(q);
	let hits = $state<Suggestion[]>([]);
	/** The query the shown suggestions answer; while a newer one is asked they stay, dimmed. */
	let answered = $state('');
	let open = $state(false);
	let active = $state(-1);
	let waiting = $state(false);
	// Answers already had in this page: going back to a shorter query shows at once.
	// Not shown anywhere, so not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const kept = new Map<string, Suggestion[]>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let asking: AbortController | null = null;

	const query = $derived(value.trim());
	const allHref = $derived(`/search?q=${encodeURIComponent(query)}`);
	/** The suggestions, then "all results"; arrows move through these. */
	const count = $derived(hits.length ? hits.length + 1 : 0);
	const expanded = $derived(open && count > 0);
	const optionId = (i: number) => `${id}-opt-${i}`;

	function show(forQuery: string, list: Suggestion[]) {
		hits = list;
		answered = forQuery;
		waiting = false;
		open = true;
	}

	function typed() {
		clearTimeout(timer);
		asking?.abort();
		active = -1;
		const now = query;
		if (now.length < MIN_CHARS) {
			hits = [];
			answered = '';
			waiting = false;
			return;
		}
		const had = kept.get(now.toLowerCase());
		if (had) return show(now, had);
		waiting = true;
		open = true;
		timer = setTimeout(() => ask(now), PAUSE_MS);
	}

	async function ask(forQuery: string) {
		const controller = new AbortController();
		asking = controller;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(forQuery)}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { hits: Suggestion[] };
			kept.set(forQuery.toLowerCase(), body.hits);
			if (query === forQuery) show(forQuery, body.hits);
		} catch {
			// Cancelled by a newer query, or search is down: Enter still opens the results page,
			// which says what is wrong.
			if (controller.signal.aborted) return;
			hits = [];
			answered = '';
			waiting = false;
		}
	}

	function close() {
		open = false;
		active = -1;
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (!count) return;
			e.preventDefault();
			open = true;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = active < 0 && step < 0 ? count - 1 : (active + step + count) % count;
		} else if (e.key === 'Enter' && expanded && active >= 0) {
			e.preventDefault();
			const href = active < hits.length ? titleHref(hits[active]) : allHref;
			close();
			goto(href);
		} else if (e.key === 'Escape' && expanded) {
			// The first Escape closes the list; the next one is the field's own (it clears it).
			e.preventDefault();
			close();
		}
	}

	function focusout(e: FocusEvent & { currentTarget: HTMLElement }) {
		if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
	}
</script>

<form
	method="GET"
	action="/search"
	role="search"
	class="relative"
	onfocusout={focusout}
	onsubmit={close}
>
	<Search
		class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
		aria-hidden="true"
	/>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		type="search"
		name="q"
		bind:value
		{autofocus}
		placeholder="Search films and series"
		aria-label="Search films and series"
		class="field pl-10"
		autocomplete="off"
		enterkeyhint="search"
		required
		role="combobox"
		aria-autocomplete="list"
		aria-controls="{id}-list"
		aria-expanded={expanded}
		aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
		oninput={typed}
		onfocus={() => query.length >= MIN_CHARS && (open = true)}
		onkeydown={keydown}
	/>
	<!-- Pressing on a suggestion would take focus from the field and close the list before the
	     click lands (Safari never focuses links), so the field keeps it. -->
	<div
		class="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden card shadow-xl transition-opacity
			{expanded ? '' : 'hidden'} {waiting ? 'opacity-60' : ''}"
		role="presentation"
		onmousedown={(e) => e.preventDefault()}
	>
		<ul
			id="{id}-list"
			role="listbox"
			aria-label="Suggestions"
			class="max-h-[70dvh] overflow-y-auto p-1"
		>
			{#each hits as h, i (`${h.media}-${h.tmdbId}`)}
				<li role="none">
					<a
						id={optionId(i)}
						href={titleHref(h)}
						role="option"
						aria-selected={active === i}
						tabindex="-1"
						class="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2 aria-selected:bg-surface-2"
						onclick={close}
					>
						<Poster
							title={h.title}
							path={h.posterPath}
							size="w185"
							showTitle={false}
							eager
							class="w-11 shrink-0 rounded-lg"
						/>
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 leading-snug font-semibold">{h.title}</span>
							<span class="block text-xs text-muted">
								{h.media === 'tv' ? 'Series' : 'Film'}{#if h.year}&nbsp;· {h.year}{/if}{#if h.imdb}&nbsp;·
									<span class="font-semibold text-ink">IMDb {h.imdb.rating.toFixed(1)}</span>{/if}
							</span>
							{#if h.overview}
								<span class="block truncate text-xs text-ink-2">{h.overview}</span>
							{/if}
						</span>
						{#if h.status}
							<span
								class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
								>{STATUS_LABEL[h.status]}</span
							>
						{/if}
					</a>
				</li>
			{/each}
			{#if hits.length}
				<li role="none" class="mt-1 border-t border-line pt-1">
					<a
						id={optionId(hits.length)}
						href={allHref}
						role="option"
						aria-selected={active === hits.length}
						tabindex="-1"
						class="flex h-11 items-center rounded-xl px-3 text-sm font-medium text-accent hover:bg-surface-2 aria-selected:bg-surface-2"
						onclick={close}>All results for “{query}”</a
					>
				</li>
			{/if}
		</ul>
	</div>
	{#if open && !waiting && answered && answered === query && !hits.length}
		<p class="absolute inset-x-0 top-full z-30 mt-1.5 card px-4 py-3 text-sm text-ink-2 shadow-xl">
			Nothing found for “{answered}”.
		</p>
	{/if}
	<p class="sr-only" aria-live="polite">
		{#if !waiting && answered && answered === query}{hits.length
				? `${hits.length} suggestions, arrows to choose`
				: 'No suggestions'}{/if}
	</p>
</form>
