<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { navigating } from '$app/state';
	import Header from '#lib/components/Header.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Lets end-to-end tests wait until the page reacts to input instead of racing hydration.
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" aria-hidden="true">
		<div class="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-accent"></div>
	</div>
{/if}

<Header user={data.user} news={data.news} />

<main class="mx-auto max-w-6xl px-4 pt-6 pb-[calc(4rem+var(--tabbar,0px))] sm:px-6">
	{@render children()}
</main>

<style>
	@keyframes -global-loading {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}
</style>
