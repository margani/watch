// Request checks shared by the own-list endpoints (#46).
import { error } from '@sveltejs/kit';
import { isMedia, type Media } from '#lib/watch.ts';

export function listIdOf(raw: string): number {
	const id = Number(raw);
	if (!Number.isSafeInteger(id) || id < 1) error(404, 'No such list');
	return id;
}

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Expected a JSON object');
	return body as Record<string, unknown>;
}

/** `{ media, tmdbId }` naming a title, or a 400. */
export function titleOf(v: unknown): { media: Media; tmdbId: number } {
	const t = v as { media?: unknown; tmdbId?: unknown } | null;
	if (
		!t ||
		typeof t.media !== 'string' ||
		!isMedia(t.media) ||
		!Number.isSafeInteger(t.tmdbId) ||
		(t.tmdbId as number) < 1
	)
		error(400, 'Name a title as { media, tmdbId }');
	return { media: t.media, tmdbId: t.tmdbId as number };
}
