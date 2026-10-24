<script lang="ts">
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { applyUpdate, pwa } from '#lib/pwa.svelte.ts';

	let dismissed = $state(false);
	let updating = $state(false);
</script>

{#if pwa.waiting && !dismissed}
	<!-- One line on a phone in every state: "Updating…" was wider than "Update" and wrapped
	     the text (#177), so the icon spins instead and the labels stay as they are. -->
	<div
		class="fixed inset-x-4 bottom-[calc(1rem+var(--tabbar,0px))] z-50 mx-auto flex max-w-md items-center gap-3 card px-4 py-3 shadow-xl"
		role="status"
		aria-busy={updating}
	>
		<RefreshCw
			class="size-5 shrink-0 text-accent {updating ? 'animate-spin' : ''}"
			aria-hidden="true"
		/>
		<p class="min-w-0 flex-1 truncate text-sm">{updating ? 'Updating…' : 'New version ready'}</p>
		<button class="btn-ghost h-9 px-3" disabled={updating} onclick={() => (dismissed = true)}
			>Later</button
		>
		<button
			class="btn-primary h-9 px-3"
			disabled={updating}
			onclick={() => {
				updating = true;
				void applyUpdate();
			}}>Update</button
		>
	</div>
{/if}
