<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Choose a new password · Watch</title></svelte:head>

<AuthShell title="Choose a new password">
	{#if data.invalid}
		<p class="rounded-xl bg-heart/10 px-3 py-2 text-sm text-heart" role="alert">
			This link has expired or was already used.
		</p>
		<a href="/forgot-password" class="btn-primary w-full">Ask for a new link</a>
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
			<input type="hidden" name="token" value={data.token} />
			<label class="flex flex-col gap-1.5 text-sm font-medium">
				New password
				<input
					class="field"
					type="password"
					name="password"
					autocomplete="new-password"
					minlength="8"
					required
				/>
			</label>
			<button class="btn-primary mt-1 w-full" type="submit" disabled={busy}>
				{busy ? 'Saving…' : 'Save password'}
			</button>
		</form>
	{/if}
</AuthShell>
