<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import GoogleButton from '#lib/components/GoogleButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Create account · Watch</title></svelte:head>

<AuthShell title="Create your account" subtitle="Sign-up is invite-only.">
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
			Name
			<input class="field" name="name" autocomplete="name" required value={form?.name ?? ''} />
		</label>
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
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Password
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
			{busy ? 'Creating…' : 'Create account'}
		</button>
	</form>
	{#if data.google}
		<div class="flex items-center gap-3 text-xs text-muted">
			<span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span>
		</div>
		<GoogleButton />
	{/if}
	<p class="text-center text-sm text-ink-2">
		Have an account? <a href="/signin" class="font-medium text-accent hover:underline">Sign in</a>
	</p>
</AuthShell>
