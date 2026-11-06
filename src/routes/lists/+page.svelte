<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ListTabs from '#lib/components/ListTabs.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import { LIST_NAME_MAX } from '#lib/list-names.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>My lists · Watch</title></svelte:head>

<h1 class="mb-4 font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">Films and series</h1>

<ListTabs current="lists" counts={data.counts} lists={data.lists.length} />

<form method="POST" action="?/create" class="mb-8 flex max-w-md gap-2">
	<label class="sr-only" for="new-list">Name of a new list</label>
	<input
		id="new-list"
		name="name"
		class="field h-11 min-w-0 flex-1"
		placeholder="A new list, e.g. Marvel in order"
		maxlength={LIST_NAME_MAX}
		required
		value={form?.name ?? ''}
	/>
	<button class="btn-primary h-11 shrink-0"
		><Plus class="size-4" aria-hidden="true" /> New list</button
	>
</form>
{#if form?.error}<p class="-mt-6 mb-6 text-sm text-heart" role="alert">{form.error}</p>{/if}

{#if !data.lists.length}
	<div class="flex flex-col items-center gap-2 card px-6 py-16 text-center">
		<p class="font-serif text-lg font-semibold">No lists yet</p>
		<p class="max-w-sm text-sm text-ink-2">
			Make a list for a film series, a marathon or anything else, and put its titles in the order
			you want to watch them.
		</p>
	</div>
{:else}
	<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.lists as l (l.id)}
			<li>
				<a
					href="/lists/{l.id}"
					class="group flex items-center gap-4 card p-3 hover:ring-2 hover:ring-accent"
				>
					<div class="flex w-28 shrink-0 -space-x-6" aria-hidden="true">
						{#each l.covers as c, i (i)}
							<Poster
								title={c.title}
								path={c.posterPath}
								size="w185"
								showTitle={false}
								class="w-12 shrink-0 ring-2 ring-bg"
							/>
						{:else}
							<div class="aspect-[2/3] w-12 rounded-md bg-surface-2"></div>
						{/each}
					</div>
					<div class="min-w-0">
						<h2 class="line-clamp-2 text-lg leading-snug font-semibold group-hover:text-accent">
							{l.name}
						</h2>
						<p class="text-sm text-ink-2">{l.count} {l.count === 1 ? 'title' : 'titles'}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
