<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { onMount } from 'svelte';
	import { syncThemeColor } from '#lib/theme-color.ts';

	let dark = $state(false);
	onMount(() => {
		dark = document.documentElement.classList.contains('dark');
	});

	function toggle() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		syncThemeColor();
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {
			// Private mode: the choice lasts for this page only.
		}
	}
</script>

<button
	type="button"
	class="icon-btn"
	onclick={toggle}
	aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
>
	{#if dark}<Sun class="size-5" />{:else}<Moon class="size-5" />{/if}
</button>
