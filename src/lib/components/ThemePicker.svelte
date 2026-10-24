<script lang="ts">
	import Palette from '@lucide/svelte/icons/palette';
	import Check from '@lucide/svelte/icons/check';
	import { onMount } from 'svelte';
	import { onDismiss } from '#lib/dismiss.ts';
	import {
		applyTheme,
		readChoice,
		resolveTheme,
		THEME_CHOICES,
		THEME_COLOURS,
		THEME_LABEL,
		type ThemeChoice
	} from '#lib/themes.ts';

	let choice = $state<ThemeChoice>('system');
	let menu = $state<HTMLDetailsElement>();
	let open = $state(false);
	const media = () => matchMedia('(prefers-color-scheme: dark)');

	onMount(() => {
		try {
			choice = readChoice(localStorage.getItem('theme'));
		} catch {
			// Storage blocked: the early script fell back to the device's setting.
		}
		// System follows the device while the page is open, too.
		const m = media();
		const follow = () =>
			choice === 'system' &&
			applyTheme(document.documentElement, resolveTheme('system', m.matches));
		m.addEventListener('change', follow);
		return () => m.removeEventListener('change', follow);
	});
	$effect(() => {
		if (menu && open) return onDismiss(menu, () => (open = false));
	});

	function pick(c: ThemeChoice) {
		choice = c;
		open = false;
		applyTheme(document.documentElement, resolveTheme(c, media().matches));
		try {
			localStorage.setItem('theme', c);
		} catch {
			// Private mode: the choice lasts for this page only.
		}
	}
</script>

<details class="relative" bind:this={menu} bind:open>
	<summary
		class="icon-btn cursor-pointer list-none [&::-webkit-details-marker]:hidden"
		aria-label="Theme: {THEME_LABEL[choice]}"
	>
		<Palette class="size-5" />
	</summary>
	<div class="absolute right-0 z-40 mt-2 w-52 card p-1 shadow-xl" role="menu" aria-label="Theme">
		{#each THEME_CHOICES as c (c)}
			{@const colours = c === 'system' ? null : THEME_COLOURS[c]}
			<button
				type="button"
				role="menuitemradio"
				aria-checked={choice === c}
				class="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-2"
				onclick={() => pick(c)}
			>
				{#if colours}
					<span
						class="size-5 shrink-0 rounded-full border-4"
						style="background: {colours.accent}; border-color: {colours.bg}; box-shadow: 0 0 0 1px var(--line)"
						aria-hidden="true"
					></span>
				{:else}
					<span
						class="size-5 shrink-0 rounded-full"
						style="background: linear-gradient(90deg, {THEME_COLOURS.paper.bg} 50%, {THEME_COLOURS
							.ink.bg} 50%); box-shadow: 0 0 0 1px var(--line)"
						aria-hidden="true"
					></span>
				{/if}
				<span class="flex-1">{THEME_LABEL[c]}</span>
				{#if choice === c}<Check class="size-4 text-accent" aria-hidden="true" />{/if}
			</button>
		{/each}
	</div>
</details>
