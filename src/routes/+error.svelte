<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Watch</title></svelte:head>

<div class="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
	<p class="font-serif text-6xl font-semibold text-muted">{page.status}</p>
	<h1 class="text-xl font-semibold">
		{page.status === 404 ? 'This page is not here' : 'Something went wrong'}
	</h1>
	{#if page.error?.message && page.status !== 404}
		<p class="text-sm text-ink-2">{page.error.message}</p>
	{/if}
	<a href="/" class="btn-primary">Back to my list</a>
</div>
