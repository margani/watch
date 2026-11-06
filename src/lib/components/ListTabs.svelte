<script lang="ts">
	import { STATUS_LABEL, WATCH_STATUSES, type WatchStatus } from '#lib/watch.ts';

	interface Props {
		/** The tab shown: a status, or 'lists' for the viewer's own lists (#46). */
		current: WatchStatus | 'lists';
		counts: Record<WatchStatus, number>;
		lists: number;
	}
	let { current, counts, lists }: Props = $props();
	const tabs = $derived([
		...WATCH_STATUSES.map((s) => ({
			key: s,
			href: `/?tab=${s}`,
			label: STATUS_LABEL[s],
			n: counts[s]
		})),
		{ key: 'lists', href: '/lists', label: 'My lists', n: lists }
	]);

	// Four tabs don't fit a phone's width, and on /lists the open tab sat past the right edge where
	// nobody saw it: scroll the row (only the row, never the page) so the open tab shows.
	let nav: HTMLElement | undefined = $state();
	// A fade at the right edge while more tabs hide there, so the row reads as scrollable.
	let more = $state(false);
	const measure = () => {
		if (nav) more = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
	};
	$effect(() => {
		void current;
		const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
		if (!nav || !tab) return;
		const row = nav.getBoundingClientRect();
		const box = tab.getBoundingClientRect();
		if (box.right > row.right) nav.scrollLeft += box.right - row.right;
		else if (box.left < row.left) nav.scrollLeft -= row.left - box.left;
		measure();
	});
</script>

<!-- overflow-y-hidden: overflow-x alone makes the row scroll vertically too, and the tabs hang 1px
	below it (-mb-px) so a scrollbar showed beside them. -->
<svelte:window onresize={measure} />

<nav
	bind:this={nav}
	onscroll={measure}
	class="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line {more
		? '[mask-image:linear-gradient(to_right,#000_80%,transparent)]'
		: ''}"
	aria-label="Watch lists"
>
	{#each tabs as t (t.key)}
		<a
			href={t.href}
			aria-current={current === t.key ? 'page' : undefined}
			class="-mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-[3px] px-2.5 text-base font-semibold whitespace-nowrap sm:px-3 {current ===
			t.key
				? 'border-accent text-ink'
				: 'border-transparent text-ink-2 hover:text-ink'}"
			>{t.label}
			<span class="font-normal text-muted">{t.n}</span></a
		>
	{/each}
</nav>
