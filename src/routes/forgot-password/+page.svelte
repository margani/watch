<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Forgot password · Watch</title></svelte:head>

<AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
	{#if form?.sent}
		<p class="rounded-xl bg-accent-soft px-3 py-2 text-sm" role="status">
			If an account exists for {form.email}, a reset link is on its way. It works for one hour.
		</p>
	{:else}
		{#if form?.message}
			<p class="rounded-xl bg-heart/10 px-3 py-2 text-sm text-heart" role="alert">{form.message}</p>
		{/if}
		<form
			method="POST"
			class="flex flex-col gap-3"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			<label class="flex flex-col gap-1.5 text-sm font-medium">
				Email
				<input
					class="field"
					type="email"
					name="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
				/>
			</label>
			<button class="btn-primary mt-1 w-full" type="submit" disabled={busy}>
				{busy ? 'Sending…' : 'Send reset link'}
			</button>
		</form>
	{/if}
	<p class="text-center text-sm text-ink-2">
		<a href="/signin" class="font-medium text-accent hover:underline">Back to sign in</a>
	</p>
</AuthShell>
