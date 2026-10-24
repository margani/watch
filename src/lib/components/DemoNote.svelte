<script lang="ts">
	let { demo }: { demo: boolean } = $props();
</script>

<!-- TMDB's logo and notice live on the About page, the "About or Credits section" its terms ask
     for (#22); every page carried them as a footer before. -->
{#if demo}
	<p class="mt-10 text-xs text-muted">
		Demo titles: TMDB is not set up here, so these films and series are made up.
	</p>
{/if}
