<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>Privacy · Watch</title></svelte:head>

<article
	class="mx-auto max-w-prose text-ink-2 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mb-3"
>
	<!-- Signed in, the phone's top bar already says Privacy. -->
	<h1
		class="mb-4 font-serif text-2xl font-semibold text-ink sm:text-3xl {page.data.user
			? 'max-sm:sr-only'
			: ''}"
	>
		Privacy
	</h1>
	<p>Watch keeps only what it needs to keep your list for you.</p>

	<h2>What is kept</h2>
	<p>
		Your name, email address and password (stored as a hash, never readable), or your Google
		account's name, email and picture if you sign in with Google. Your list: the films and series on
		it, their status, your ratings, the episodes you have watched, your streaming services, country,
		own links and email setting. A cookie keeps you signed in.
	</p>

	<h2>What is not</h2>
	<p>
		No tracking, analytics or adverts. A Netflix viewing history you import is read in your browser;
		only the titles are sent, to be matched, and the file itself is not kept.
	</p>

	<h2>Who else sees it</h2>
	<p>
		Nobody else using the site sees your list. Title details come from TMDB, and the scores from
		OMDb; they are asked about titles, never about you. Emails go out through Cloudflare, which also
		hosts the site.
	</p>

	<h2>Your choices</h2>
	<p>
		On your <a href="/account" class="text-accent underline">account page</a> you can download all of
		it as a file, or delete the account, which removes everything at once.
	</p>
</article>
