<script lang="ts">
	import { onDismiss } from '#lib/dismiss.ts';
	import { page } from '$app/state';
	import ListVideo from '@lucide/svelte/icons/list-video';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Search from '@lucide/svelte/icons/search';
	import Tv from '@lucide/svelte/icons/tv';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Shield from '@lucide/svelte/icons/shield';
	import UserRound from '@lucide/svelte/icons/user-round';
	import ThemePicker from './ThemePicker.svelte';

	interface Props {
		user: { name: string; email: string; image?: string | null } | null;
		/** Unseen news on the list: a dot on My list. */
		news?: number;
	}

	let { user, news = 0 }: Props = $props();

	const initials = $derived(
		(user?.name || user?.email || '?')
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
	const path = $derived(page.url.pathname);
	const onSearch = $derived(path === '/search');
	const onForYou = $derived(path === '/for-you');
	const onServices = $derived(path === '/services');
	// Title pages and the import belong to the list; the account pages to no section.
	const other: Record<string, string> = { '/account': 'Account', '/privacy': 'Privacy' };
	const onList = $derived(!onSearch && !onForYou && !onServices && !(path in other));

	// On a phone the sections are a tab bar at the bottom, within thumb reach, and the top row
	// names the section.
	const sections = $derived([
		{ href: '/', label: 'My list', icon: ListVideo, current: onList },
		{ href: '/for-you', label: 'For you', icon: Sparkles, current: onForYou },
		{ href: '/search', label: 'Search', icon: Search, current: onSearch },
		{ href: '/services', label: 'Services', icon: Tv, current: onServices }
	]);
	const title = $derived(sections.find((s) => s.current)?.label ?? other[path] ?? 'Watch');

	// The account menu closes on a click outside or Escape, like the other popovers.
	let account = $state<HTMLDetailsElement>();
	let accountOpen = $state(false);
	$effect(() => {
		if (account && accountOpen) return onDismiss(account, () => (accountOpen = false));
	});
</script>

<header class="app-header sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
		<a
			href="/"
			class="mr-1 shrink-0 items-center gap-2 font-serif text-lg font-semibold tracking-tight sm:mr-3 {user
				? 'hidden sm:flex'
				: 'flex'}"
			aria-label="Watch home"
		>
			<img src="/favicon.svg" alt="" class="size-7" />
			<span class={user ? 'hidden sm:inline' : ''}>Watch</span>
		</a>
		{#if user}
			<p class="min-w-0 truncate font-serif text-lg font-semibold tracking-tight sm:hidden">
				{title}
			</p>
			<nav class="hidden items-center gap-1 text-sm sm:flex" aria-label="Main">
				{#each sections as s (s.href)}
					<a
						href={s.href}
						class="relative rounded-full px-3 py-2 whitespace-nowrap text-ink-2 hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
						aria-current={s.current ? 'page' : undefined}
						aria-label={s.href === '/' && news ? `My list, ${news} new` : undefined}
						>{s.label}{#if s.href === '/' && news}<span
								class="absolute top-1.5 right-1 size-2 rounded-full bg-heart"
								aria-hidden="true"
							></span>{/if}</a
					>
				{/each}
			</nav>
		{/if}
		<div class="ml-auto flex shrink-0 items-center gap-1">
			<ThemePicker />
			{#if user}
				<details class="relative" bind:this={account} bind:open={accountOpen}>
					<summary
						class="flex size-10 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden"
						aria-label="Account"
					>
						{#if user.image}
							<img src={user.image} alt="" class="size-8 rounded-full object-cover" />
						{:else}
							<span
								class="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink"
								>{initials}</span
							>
						{/if}
					</summary>
					<div class="absolute right-0 mt-2 w-64 overflow-hidden card p-1 shadow-xl" role="menu">
						<div class="px-3 py-2">
							<p class="truncate text-sm font-medium">{user.name}</p>
							<p class="truncate text-xs text-muted">{user.email}</p>
						</div>
						<a
							href="/account"
							role="menuitem"
							class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
						>
							<UserRound class="size-4" /> Account
						</a>
						<a
							href="/privacy"
							role="menuitem"
							class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
						>
							<Shield class="size-4" /> Privacy
						</a>
						<form method="POST" action="/signout">
							<button
								type="submit"
								role="menuitem"
								class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
							>
								<LogOut class="size-4" /> Sign out
							</button>
						</form>
					</div>
				</details>
			{/if}
		</div>
	</div>
</header>

{#if user}
	<!-- Outside the header: its backdrop filter would make it the bar's containing block. -->
	<nav
		class="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
		aria-label="Main"
	>
		<div class="flex h-16 items-stretch">
			{#each sections as s (s.href)}
				<a
					href={s.href}
					class="-mt-px flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-[3px] border-transparent text-xs leading-none text-ink-2 aria-[current=page]:border-accent aria-[current=page]:font-bold aria-[current=page]:text-accent"
					aria-current={s.current ? 'page' : undefined}
					aria-label={s.href === '/' && news ? `My list, ${news} new` : undefined}
					><span class="relative inline-flex"
						><s.icon class="size-6" aria-hidden="true" />{#if s.href === '/' && news}<span
								class="absolute -top-0.5 -right-1 size-2 rounded-full bg-heart"
								aria-hidden="true"
							></span>{/if}</span
					><span class="max-w-full truncate px-0.5">{s.label}</span></a
				>
			{/each}
		</div>
	</nav>
{/if}
