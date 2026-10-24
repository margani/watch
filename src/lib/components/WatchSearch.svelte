<script lang="ts">
	import Search from '@lucide/svelte/icons/search';

	interface Props {
		q?: string;
		autofocus?: boolean;
	}
	let { q = '', autofocus = false }: Props = $props();
</script>

<form method="GET" action="/search" role="search" class="relative">
	<Search
		class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
		aria-hidden="true"
	/>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		type="search"
		name="q"
		value={q}
		{autofocus}
		placeholder="Search films and series"
		aria-label="Search films and series"
		class="field pl-10"
		autocomplete="off"
		enterkeyhint="search"
		required
	/>
</form>
