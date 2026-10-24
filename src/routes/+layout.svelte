<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { navigating } from '$app/state';
	import { dev } from '$app/env';
	import Header from '#lib/components/Header.svelte';
	import UpdateBanner from '#lib/components/UpdateBanner.svelte';
	import {
		checkForUpdate,
		refreshIfUpdated,
		startPwa,
		watchInstallPrompt
	} from '#lib/pwa.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Lets end-to-end tests wait until the page reacts to input instead of racing hydration.
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
		watchInstallPrompt();
		// The service worker exists only in production builds.
		if (!dev) startPwa().catch((e) => console.error('service worker:', e));
	});
	afterNavigate(() => {
		// Moving between pages loads none, so the browser's own update check never runs.
		checkForUpdate();
		// A page opened from the device's copy of its data whose newer data arrived meanwhile (#7).
		refreshIfUpdated();
	});
</script>

{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" aria-hidden="true">
		<div class="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-accent"></div>
	</div>
{/if}

<Header user={data.user} news={data.news} />
<UpdateBanner />

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
