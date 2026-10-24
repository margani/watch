<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, subtitle, children }: { title: string; subtitle?: string; children: Snippet } =
		$props();
</script>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-10 sm:py-16">
	<div class="text-center">
		<img src="/favicon.svg" alt="" class="mx-auto mb-4 size-12" />
		<h1 class="font-serif text-2xl font-semibold">{title}</h1>
		{#if subtitle}<p class="mt-2 text-sm text-ink-2">{subtitle}</p>{/if}
	</div>
	<div class="flex flex-col gap-4 card p-6">
		{@render children()}
	</div>
	<p class="text-center text-xs text-muted">
		<a href="/privacy" class="hover:text-ink hover:underline">Privacy</a>
	</p>
</div>
