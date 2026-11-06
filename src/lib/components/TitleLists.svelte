<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import { LIST_NAME_MAX } from '#lib/list-names.ts';
	import type { Media } from '#lib/watch.ts';

	// The title page's part of the viewer's own lists (#46): one tap puts the title on a list or
	// takes it off; a new list can be made here with the title already on it.
	interface Props {
		media: Media;
		tmdbId: number;
		lists: { id: number; name: string; has: boolean }[];
	}
	let { media, tmdbId, lists }: Props = $props();

	let changed = $state<Record<number, boolean>>({});
	let made = $state<{ id: number; name: string }[]>([]);
	const shown = $derived([
		...made.map((l) => ({ ...l, has: true })),
		...lists.filter((l) => !made.some((m) => m.id === l.id))
	]);
	const has = (l: { id: number; has: boolean }) => changed[l.id] ?? l.has;
	let busy = $state(false);
	let failed = $state(false);
	let adding = $state(false);
	let name = $state('');
	let input = $state<HTMLInputElement>();

	async function toggle(l: { id: number; has: boolean }) {
		busy = true;
		failed = false;
		const on = !has(l);
		const res = await fetch(`/api/lists/${l.id}/titles`, {
			method: on ? 'PUT' : 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ media, tmdbId })
		}).catch(() => null);
		if (res?.ok) changed[l.id] = on;
		else failed = true;
		busy = false;
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		busy = true;
		failed = false;
		const res = await fetch('/api/lists', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, add: { media, tmdbId } })
		}).catch(() => null);
		if (res?.ok) {
			made = [await res.json(), ...made];
			name = '';
			adding = false;
		} else failed = true;
		busy = false;
	}

	$effect(() => {
		// The field appears after the tap, so autofocus would not fire.
		if (adding) input?.focus();
	});
</script>

<section class="mt-4 text-sm" aria-labelledby="own-lists-heading">
	<h2 id="own-lists-heading" class="mb-2 font-semibold">
		<a href="/lists" class="hover:text-accent">My lists</a>
	</h2>
	<div class="flex flex-wrap items-center gap-2">
		{#each shown as l (l.id)}
			<button
				type="button"
				class="chip h-9 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink"
				aria-pressed={has(l)}
				disabled={busy}
				onclick={() => toggle(l)}
				>{#if has(l)}<Check class="size-3.5" aria-hidden="true" />{:else}<Plus
						class="size-3.5"
						aria-hidden="true"
					/>{/if}{l.name}</button
			>
		{/each}
		{#if !adding}
			<button
				type="button"
				class="chip h-9 border-dashed"
				onclick={() => (adding = true)}
				disabled={busy}><Plus class="size-3.5" aria-hidden="true" /> New list</button
			>
		{/if}
	</div>
	{#if adding}
		<form class="mt-2 flex max-w-md gap-2" onsubmit={create}>
			<label class="sr-only" for="title-new-list">Name of the new list</label>
			<input
				id="title-new-list"
				class="field h-10 min-w-0 flex-1"
				placeholder="Name of the new list"
				maxlength={LIST_NAME_MAX}
				required
				bind:this={input}
				bind:value={name}
			/>
			<button class="btn-primary shrink-0" disabled={busy}>Make it</button>
			<button type="button" class="btn-ghost shrink-0" onclick={() => (adding = false)}
				>Cancel</button
			>
		</form>
	{/if}
	{#if failed}<p class="mt-2 text-heart" role="alert">Could not save, try again.</p>{/if}
</section>
