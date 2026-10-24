<script lang="ts">
	interface Props {
		demo: boolean;
	}
	let { demo }: Props = $props();
</script>

<!-- TMDB's terms: its logo, less prominent than the app's, and this exact notice. -->
<footer class="mt-12 flex flex-col items-start gap-2 border-t border-line pt-4 text-xs text-muted">
	<h2 class="font-medium text-ink-2">Credits</h2>
	<a href="https://www.themoviedb.org/" class="inline-flex" rel="noopener noreferrer">
		<img src="/credits/tmdb.svg" alt="TMDB" class="h-3" />
	</a>
	<p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
	{#if demo}
		<p>Demo titles: TMDB is not set up here, so these films and series are made up.</p>
	{/if}
</footer>
