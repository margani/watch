<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Check from '@lucide/svelte/icons/check';
	import Poster from '#lib/components/Poster.svelte';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { holdToDrag } from '#lib/hold-to-drag.ts';
	import { LIST_NAME_MAX } from '#lib/list-names.ts';
	import { STATUS_LABEL, titleHref } from '#lib/watch.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The order to watch in (#46): hold a title and drag it, as on the main list (#21); Alt and the
	// arrow keys with a keyboard. A move shows at once, then the list loads again.
	type Row = (typeof data.list.titles)[number];
	const keyOf = (t: { media: string; tmdbId: number }) => `${t.media}-${t.tmdbId}`;
	let moved = $state<Row[] | null>(null);
	let drag = $state<{ from: number; to: number; dx: number; dy: number } | null>(null);
	const placed = (list: Row[], from: number, to: number) => {
		const l = [...list];
		l.splice(to, 0, ...l.splice(from, 1));
		return l;
	};
	const shown = $derived(moved ?? data.list.titles);
	const titles = $derived(drag ? placed(shown, drag.from, drag.to) : shown);
	const draggedKey = $derived(drag ? keyOf(shown[drag.from]) : null);
	let failed = $state('');
	let announce = $state('');
	let listEl = $state<HTMLOListElement>();
	// Moves go one after another, each against the order the one before left (as on the main list).
	let saving: Promise<void> = Promise.resolve();
	let unsaved = 0;

	function send(method: string, path: string, body: object) {
		return fetch(`/api/lists/${data.list.id}${path}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => null);
	}

	function commit(from: number, to: number) {
		if (from === to || to < 0 || to >= shown.length) return;
		failed = '';
		const t = shown[from];
		moved = placed(shown, from, to);
		announce = `${t.title} moved to place ${to + 1} of ${shown.length}.`;
		unsaved++;
		saving = saving.then(async () => {
			const res = await send('POST', '/move', { media: t.media, tmdbId: t.tmdbId, to });
			if (!res?.ok) failed = 'Could not move it, try again.';
			if (--unsaved) return;
			await invalidateAll();
			if (!unsaved) moved = null;
		});
	}

	function onKey(e: KeyboardEvent, i: number, t: Row) {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		const key = keyOf(t);
		commit(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
		void tick().then(() => listEl?.querySelector<HTMLElement>(`[data-key="${key}"] a`)?.focus());
	}

	$effect(() => {
		if (!listEl) return;
		return holdToDrag(listEl, {
			rows: () => [...listEl!.children] as HTMLElement[],
			canStart: () => shown.length > 1,
			onMove: (from, to, dx, dy) => (drag = { from, to, dx, dy }),
			onDrop: (from, to) => {
				drag = null;
				commit(from, to);
			},
			onCancel: () => (drag = null)
		});
	});

	let busy = $state<string | null>(null);
	async function change(
		method: 'PUT' | 'DELETE',
		t: { media: string; tmdbId: number; title: string }
	) {
		busy = keyOf(t);
		failed = '';
		// Wait for moves still being saved, so a removal can't be undone by an older order.
		await saving;
		const res = await send(method, '/titles', { media: t.media, tmdbId: t.tmdbId });
		if (res?.ok) {
			announce = method === 'PUT' ? `${t.title} added at the end.` : `${t.title} removed.`;
			await invalidateAll();
		} else
			failed =
				method === 'PUT' ? 'Could not add it, try again.' : 'Could not remove it, try again.';
		busy = null;
	}

	// Titles from the viewer's main list that aren't on this one yet, filtered as they type.
	let filter = $state('');
	const onList = $derived(new Set(data.list.titles.map(keyOf)));
	const candidates = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		const left = data.pickable.filter((t) => !onList.has(keyOf(t)));
		return (q ? left.filter((t) => t.title.toLowerCase().includes(q)) : left).slice(0, 12);
	});
	const leftCount = $derived(data.pickable.filter((t) => !onList.has(keyOf(t))).length);
</script>

<svelte:head><title>{data.list.name} · Watch</title></svelte:head>

<a href="/lists" class="mb-4 inline-block text-sm text-ink-2 hover:text-ink">← My lists</a>

<div class="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
	<div class="min-w-0">
		<h1 class="font-serif text-2xl leading-tight font-semibold break-words sm:text-3xl">
			{data.list.name}
		</h1>
		<p class="mt-1 text-sm text-ink-2">
			{data.list.titles.length}
			{data.list.titles.length === 1 ? 'title' : 'titles'}{#if data.list.titles.length > 1}, in the
				order to watch them{/if}
		</p>
	</div>
	<div class="flex shrink-0 gap-2">
		<details class="relative" open={!!form?.renameError}>
			<summary class="btn-ghost h-10 cursor-pointer list-none">Rename</summary>
			<form
				method="POST"
				action="?/rename"
				class="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-2 card p-3 shadow-xl"
			>
				<label class="text-sm font-medium" for="list-name">New name</label>
				<input
					id="list-name"
					name="name"
					class="field"
					maxlength={LIST_NAME_MAX}
					required
					value={data.list.name}
				/>
				{#if form?.renameError}<p class="text-sm text-heart" role="alert">
						{form.renameError}
					</p>{/if}
				<button class="btn-primary self-end">Save</button>
			</form>
		</details>
		<details class="relative">
			<summary class="btn-ghost h-10 cursor-pointer list-none">Delete</summary>
			<form
				method="POST"
				action="?/delete"
				class="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-2 card p-3 shadow-xl"
			>
				<p class="text-sm">
					Delete this list? The titles stay on your main list; only this list and its order go.
				</p>
				<button class="btn self-end bg-heart text-bg hover:opacity-90">Delete the list</button>
			</form>
		</details>
	</div>
</div>

<p class="sr-only" id="order-help">
	Hold a title, then drag it to its place in the order. With a keyboard: Alt and the arrow keys.
</p>
<p class="sr-only" aria-live="polite">{announce}</p>
{#if failed}<p class="mt-3 text-sm text-heart" role="alert">{failed}</p>{/if}

{#if !titles.length}
	<div class="mt-4 flex flex-col items-center gap-2 card px-6 py-12 text-center">
		<p class="font-serif text-lg font-semibold">Nothing on this list yet</p>
		<p class="max-w-sm text-sm text-ink-2">
			Add titles below, or from any title's page. Then hold one and drag it to set the order.
		</p>
	</div>
{:else}
	{#if titles.length > 1}
		<p class="mt-3 mb-1 text-sm text-muted" aria-hidden="true">
			Hold a title and drag it to change the order.
		</p>
	{/if}
	<ol
		class="grid grid-cols-1 gap-x-8 sm:grid-cols-2"
		bind:this={listEl}
		aria-describedby="order-help"
	>
		{#each titles as t, i (keyOf(t))}
			<li
				data-key={keyOf(t)}
				class="relative flex items-center gap-2 border-b border-line bg-bg select-none [-webkit-touch-callout:none] {draggedKey ===
				keyOf(t)
					? 'z-10 rounded-2xl shadow-xl ring-1 ring-line'
					: ''}"
				style={draggedKey === keyOf(t) && drag
					? `transform: translate(${drag.dx}px, ${drag.dy}px) scale(1.02)`
					: undefined}
			>
				<a
					href={titleHref(t)}
					class="group flex min-w-0 flex-1 items-center gap-3 py-3"
					draggable="false"
					onkeydown={(e) => onKey(e, i, t)}
				>
					<span
						class="w-7 shrink-0 text-center font-serif text-xl font-semibold text-muted tabular-nums"
						aria-label="Number {i + 1}">{i + 1}</span
					>
					<Poster
						title={t.title}
						path={t.posterPath}
						size="w185"
						showTitle={false}
						class="w-12 shrink-0 group-hover:ring-2 group-hover:ring-accent"
					/>
					<div class="min-w-0 flex-1">
						<h2 class="line-clamp-2 leading-snug font-semibold group-hover:text-accent">
							{t.title}
						</h2>
						<p class="mt-0.5 text-sm text-ink-2">
							{t.media === 'tv' ? 'Series' : 'Film'}{#if t.year}&nbsp;· {t.year}{/if}{#if t.status}&nbsp;·
								{#if t.status === 'watched'}<span class="font-medium text-accent"
										><Check class="inline size-3.5 align-[-2px]" aria-hidden="true" /> Watched</span
									>{:else}{STATUS_LABEL[t.status]}{/if}{/if}
						</p>
					</div>
				</a>
				<button
					type="button"
					class="icon-btn"
					aria-label="Remove {t.title} from this list"
					title="Remove from this list"
					disabled={busy === keyOf(t)}
					onclick={() => change('DELETE', t)}><X class="size-4" aria-hidden="true" /></button
				>
			</li>
		{/each}
	</ol>
{/if}

<section class="mt-10" aria-labelledby="add-heading">
	<h2 id="add-heading" class="mb-3 font-serif text-lg font-semibold">Add from my list</h2>
	{#if !data.pickable.length}
		<p class="text-sm text-ink-2">
			Titles you mark as Want to watch, Watching or Watched show up here. Any other title can be
			added from its own page: <a href="/search" class="text-accent hover:underline">search</a> for it.
		</p>
	{:else if !leftCount}
		<p class="text-sm text-ink-2">
			Everything on your main list is on this one. Other titles can be added from their own page.
		</p>
	{:else}
		<label class="sr-only" for="pick-filter">Find a title on my list</label>
		<input
			id="pick-filter"
			class="mb-3 field max-w-md"
			placeholder="Find a title on my list"
			bind:value={filter}
			autocomplete="off"
		/>
		{#if !candidates.length}
			<p class="text-sm text-ink-2">
				Nothing on your list matches. <a
					href="/search?q={encodeURIComponent(filter)}"
					class="text-accent hover:underline">Search all titles</a
				> and add it from its page.
			</p>
		{:else}
			<ul class="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
				{#each candidates as t (keyOf(t))}
					<li class="flex items-center gap-3 border-b border-line py-2">
						<Poster
							title={t.title}
							path={t.posterPath}
							size="w185"
							showTitle={false}
							class="w-9 shrink-0"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{t.title}</p>
							<p class="text-xs text-muted">
								{t.media === 'tv' ? 'Series' : 'Film'}{#if t.year}&nbsp;· {t.year}{/if}&nbsp;· {STATUS_LABEL[
									t.status
								]}
							</p>
						</div>
						<button
							type="button"
							class="btn-ghost h-9 shrink-0 px-3"
							disabled={busy === keyOf(t)}
							aria-label="Add {t.title} to this list"
							onclick={() => change('PUT', t)}
							><Plus class="size-4" aria-hidden="true" /> Add</button
						>
					</li>
				{/each}
			</ul>
			{#if leftCount > candidates.length && !filter}
				<p class="mt-2 text-sm text-muted">
					{leftCount - candidates.length} more: type to find them.
				</p>
			{/if}
		{/if}
	{/if}
</section>
