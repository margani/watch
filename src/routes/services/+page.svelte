<script lang="ts">
	import { goto } from '$app/navigation';
	import ProviderLogo from '#lib/components/ProviderLogo.svelte';
	import DemoNote from '#lib/components/DemoNote.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let filter = $state('');
	const mine = $derived(new Set(data.mine));
	const shown = $derived(
		data.services.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()))
	);
</script>

<svelte:head><title>Your services · Watch</title></svelte:head>

<a href="/" class="mb-4 inline-block text-sm text-ink-2 hover:text-ink">← Films and series</a>

<h1 class="mb-2 font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">
	Your streaming services
</h1>
<p class="mb-6 max-w-prose text-sm text-ink-2">
	Pick the services you subscribe to. Each film and series then shows whether one of them has it
	where you are.
</p>

<form method="POST" action="?/services" class="flex flex-col gap-5">
	<label class="flex max-w-sm flex-col gap-1 text-sm text-ink-2">
		Country
		<select
			name="country"
			class="field h-10 text-ink"
			value={data.country}
			onchange={(e) =>
				goto(`?country=${(e.currentTarget as HTMLSelectElement).value}`, { replace: true })}
		>
			{#each data.regions as r (r.code)}
				<option value={r.code}>{r.name}</option>
			{/each}
		</select>
	</label>

	<fieldset class="flex flex-col gap-3">
		<legend class="mb-2 text-sm font-semibold">
			Services in {data.regions.find((r) => r.code === data.country)?.name ?? data.country}
		</legend>
		<input
			type="search"
			class="field h-10 max-w-sm"
			placeholder="Find a service"
			aria-label="Find a service"
			bind:value={filter}
		/>
		<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Services">
			{#each data.services as p (p.id)}
				<!-- Hidden rather than removed while filtering, so ticked services are still sent. -->
				<li class:hidden={!shown.includes(p)}>
					<label
						class="flex cursor-pointer items-center gap-3 card px-3 py-2 has-checked:border-accent"
					>
						<input type="checkbox" name="service" value={p.id} checked={mine.has(p.id)} />
						<ProviderLogo provider={p} decorative />
						<span class="min-w-0 truncate text-sm">{p.name}</span>
					</label>
				</li>
			{/each}
		</ul>
		{#if !shown.length}<p class="text-sm text-muted">No service by that name here.</p>{/if}
	</fieldset>

	{#if form?.error}<p class="text-sm text-heart" role="alert">{form.error}</p>{/if}
	<div><button type="submit" class="btn-primary h-10">Save</button></div>
</form>

<section class="mt-10 max-w-2xl" aria-labelledby="links-heading">
	<h2 id="links-heading" class="mb-2 font-serif text-xl font-semibold">Your own links</h2>
	<p class="mb-3 text-sm text-ink-2">
		Links on every title page, only for you: one a line, a name, then <code>|</code> and an address
		with <code>{'{imdb}'}</code>, <code>{'{tmdb}'}</code>, <code>{'{media}'}</code> or
		<code>{'{title}'}</code> where the title goes.
	</p>
	<form method="POST" action="?/links" class="flex flex-col gap-3">
		<textarea
			name="links"
			rows="4"
			class="w-full rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
			placeholder={'IMDb | https://www.imdb.com/title/{imdb}/'}
			aria-label="Your own links"
			value={form?.links ?? data.links}></textarea>
		{#if form?.linksError}<p class="text-sm text-heart" role="alert">{form.linksError}</p>{/if}
		{#if form?.linksSaved}<p class="text-sm text-ink-2" role="status">Links saved.</p>{/if}
		<div><button type="submit" class="btn-ghost h-10">Save links</button></div>
	</form>
</section>

<DemoNote demo={data.demo} />
