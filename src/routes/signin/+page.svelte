<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import GoogleButton from '#lib/components/GoogleButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Watch</title></svelte:head>

<AuthShell title="Welcome back" subtitle="Sign in to your films and series.">
	{#if data.deleted && !form?.message}
		<p class="rounded-xl bg-accent-soft px-3 py-2 text-sm" role="status">
			Your account and everything on it were deleted.
		</p>
	{/if}
	{#if data.reset && !form?.message}
		<p class="rounded-xl bg-accent-soft px-3 py-2 text-sm" role="status">
			Password changed. Sign in with the new one.
		</p>
	{/if}
	{#if form?.message || data.error}
		<p class="rounded-xl bg-heart/10 px-3 py-2 text-sm text-heart" role="alert">
			{form?.message ?? 'Sign-in did not complete. Try again.'}
		</p>
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
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Password
			<input
				class="field"
				type="password"
				name="password"
				autocomplete="current-password"
				required
			/>
		</label>
		<a href="/forgot-password" class="-mt-1 self-end text-xs text-accent hover:underline"
			>Forgot password?</a
		>
		<button class="btn-primary mt-1 w-full" type="submit" disabled={busy}>
			{busy ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
	{#if data.google}
		<div class="flex items-center gap-3 text-xs text-muted">
			<span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span>
		</div>
		<GoogleButton next={data.next} />
	{/if}
	<p class="text-center text-sm text-ink-2">
		New here? <a href="/signup" class="font-medium text-accent hover:underline">Create an account</a
		>
	</p>
</AuthShell>
