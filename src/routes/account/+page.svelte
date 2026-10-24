<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Account · Watch</title></svelte:head>

<h1 class="mb-6 font-serif text-2xl font-semibold max-sm:sr-only sm:text-3xl">Account</h1>

<section class="mb-8 max-w-prose" aria-labelledby="export-heading">
	<h2 id="export-heading" class="mb-2 font-serif text-xl font-semibold">Your data</h2>
	<p class="mb-3 text-sm text-ink-2">
		Your list, ratings, watched episodes, services and settings as one JSON file.
	</p>
	<a href="/account/export" class="btn-ghost h-10" download>Download my data</a>
</section>

<section class="max-w-prose card p-5" aria-labelledby="delete-heading">
	<h2 id="delete-heading" class="mb-2 font-serif text-xl font-semibold">Delete account</h2>
	<p class="mb-3 text-sm text-ink-2">
		This removes your account and everything on it, at once and for good. Type
		<strong>{data.email}</strong> to confirm.
	</p>
	<form method="POST" action="?/delete" class="flex flex-col gap-3 sm:flex-row">
		<input
			name="confirm"
			type="email"
			class="field"
			autocomplete="off"
			aria-label="Your email address"
			required
		/>
		<button
			type="submit"
			class="btn h-10 shrink-0 bg-heart text-white hover:opacity-90 dark:text-bg"
		>
			Delete my account
		</button>
	</form>
	{#if form?.error}<p class="mt-2 text-sm text-heart" role="alert">{form.error}</p>{/if}
</section>
