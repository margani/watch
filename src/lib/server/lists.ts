// The viewer's own named lists (#46), each in the order they want to watch it. Every query goes
// through `watch_lists.user_id`: a list id from someone else answers as if it did not exist.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Media, WatchStatus } from '#lib/watch.ts';
import type { Db } from './db';
import { watchListItems, watchLists, watchlist, watchTitles } from './db/schema';

import { LIST_NAME_MAX } from '#lib/list-names.ts';

export { LIST_NAME_MAX };

/** A list name as typed, trimmed to single spaces; null when empty or too long. */
export function listName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.replace(/\s+/g, ' ').trim();
	return name && name.length <= LIST_NAME_MAX ? name : null;
}

const ORDER = [asc(watchListItems.position), asc(watchListItems.addedAt), asc(watchTitles.id)];

/** How many lists the viewer has: the number on the My lists tab. */
export async function listCount(db: Db, userId: string) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(watchLists)
		.where(eq(watchLists.userId, userId));
	return row?.n ?? 0;
}

/** The viewer's lists, newest first, with how many titles each has and the first few posters. */
export async function myLists(db: Db, userId: string) {
	const lists = await db
		.select({
			id: watchLists.id,
			name: watchLists.name,
			count: sql<number>`(select count(*) from ${watchListItems} i where i.list_id = ${watchLists.id})`
		})
		.from(watchLists)
		.where(eq(watchLists.userId, userId))
		.orderBy(desc(watchLists.createdAt), desc(watchLists.id));
	if (!lists.length) return [];
	const items = await db
		.select({
			listId: watchListItems.listId,
			title: watchTitles.title,
			posterPath: watchTitles.posterPath
		})
		.from(watchListItems)
		.innerJoin(watchTitles, eq(watchTitles.id, watchListItems.titleId))
		.innerJoin(watchLists, eq(watchLists.id, watchListItems.listId))
		.where(eq(watchLists.userId, userId))
		.orderBy(...ORDER);
	return lists.map((l) => ({
		...l,
		covers: items.filter((i) => i.listId === l.id).slice(0, 4)
	}));
}

async function owned(db: Db, userId: string, listId: number) {
	const [row] = await db
		.select({ id: watchLists.id, name: watchLists.name })
		.from(watchLists)
		.where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)));
	return row ?? null;
}

export async function createList(db: Db, userId: string, name: string) {
	const [row] = await db
		.insert(watchLists)
		.values({ userId, name })
		.returning({ id: watchLists.id });
	return row.id;
}

export async function renameList(db: Db, userId: string, listId: number, name: string) {
	const done = await db
		.update(watchLists)
		.set({ name })
		.where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
		.returning({ id: watchLists.id });
	return done.length > 0;
}

export async function deleteList(db: Db, userId: string, listId: number) {
	const done = await db
		.delete(watchLists)
		.where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
		.returning({ id: watchLists.id });
	return done.length > 0;
}

/** One list with its titles in the viewer's order, and where each stands on their main list. */
export async function listWithTitles(db: Db, userId: string, listId: number) {
	const list = await owned(db, userId, listId);
	if (!list) return null;
	const rows = await db
		.select({
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			year: watchTitles.year,
			posterPath: watchTitles.posterPath,
			status: watchlist.status
		})
		.from(watchListItems)
		.innerJoin(watchTitles, eq(watchTitles.id, watchListItems.titleId))
		.leftJoin(
			watchlist,
			and(eq(watchlist.titleId, watchListItems.titleId), eq(watchlist.userId, userId))
		)
		.where(eq(watchListItems.listId, listId))
		.orderBy(...ORDER);
	return {
		...list,
		titles: rows.map((r) => ({
			...r,
			media: r.media as Media,
			status: r.status as WatchStatus | null
		}))
	};
}

/** Puts a stored title at the end of the list: the next one to watch after the rest. */
export async function addToList(db: Db, userId: string, listId: number, titleId: number) {
	if (!(await owned(db, userId, listId))) return false;
	const [row] = await db
		.select({ last: sql<number | null>`max(${watchListItems.position})` })
		.from(watchListItems)
		.where(eq(watchListItems.listId, listId));
	await db
		.insert(watchListItems)
		.values({ listId, titleId, position: (row?.last ?? -1) + 1 })
		.onConflictDoNothing();
	return true;
}

async function titleIdOf(db: Db, media: Media, tmdbId: number) {
	const [row] = await db
		.select({ id: watchTitles.id })
		.from(watchTitles)
		.where(and(eq(watchTitles.media, media), eq(watchTitles.tmdbId, tmdbId)));
	return row?.id ?? null;
}

export async function removeFromList(
	db: Db,
	userId: string,
	listId: number,
	media: Media,
	tmdbId: number
) {
	if (!(await owned(db, userId, listId))) return false;
	const titleId = await titleIdOf(db, media, tmdbId);
	if (titleId)
		await db
			.delete(watchListItems)
			.where(and(eq(watchListItems.listId, listId), eq(watchListItems.titleId, titleId)));
	return true;
}

/**
 * Puts a title at this place in the list, 0 being the first to watch. Returns false when the list
 * isn't the viewer's or the title isn't on it.
 */
export async function moveInList(
	db: Db,
	userId: string,
	listId: number,
	media: Media,
	tmdbId: number,
	to: number
) {
	if (!(await owned(db, userId, listId))) return false;
	const titleId = await titleIdOf(db, media, tmdbId);
	if (!titleId) return false;
	const rows = await db
		.select({ titleId: watchListItems.titleId })
		.from(watchListItems)
		.innerJoin(watchTitles, eq(watchTitles.id, watchListItems.titleId))
		.where(eq(watchListItems.listId, listId))
		.orderBy(...ORDER);
	if (!rows.some((r) => r.titleId === titleId)) return false;
	const order = rows.map((r) => r.titleId).filter((id) => id !== titleId);
	order.splice(Math.max(0, Math.min(to, order.length)), 0, titleId);
	// Every title gets its place's number, as on the main list, so ties can't undo the move.
	const [first, ...rest] = order.map((id, k) =>
		db
			.update(watchListItems)
			.set({ position: k })
			.where(and(eq(watchListItems.listId, listId), eq(watchListItems.titleId, id)))
	);
	await db.batch([first, ...rest]);
	return true;
}

/** The viewer's lists, each saying whether this title is on it: the title page's choices. */
export async function listsForTitle(db: Db, userId: string, media: Media, tmdbId: number) {
	const [lists, titleId] = await Promise.all([
		db
			.select({ id: watchLists.id, name: watchLists.name })
			.from(watchLists)
			.where(eq(watchLists.userId, userId))
			.orderBy(desc(watchLists.createdAt), desc(watchLists.id)),
		titleIdOf(db, media, tmdbId)
	]);
	if (!lists.length || !titleId) return lists.map((l) => ({ ...l, has: false }));
	const on = await db
		.select({ listId: watchListItems.listId })
		.from(watchListItems)
		.where(
			and(
				eq(watchListItems.titleId, titleId),
				inArray(
					watchListItems.listId,
					lists.map((l) => l.id)
				)
			)
		);
	const has = new Set(on.map((r) => r.listId));
	return lists.map((l) => ({ ...l, has: has.has(l.id) }));
}

/** Titles on the viewer's main list, to pick from when filling one of their own lists. */
export async function pickableTitles(db: Db, userId: string) {
	const rows = await db
		.select({
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			year: watchTitles.year,
			posterPath: watchTitles.posterPath,
			status: watchlist.status
		})
		.from(watchlist)
		.innerJoin(watchTitles, eq(watchTitles.id, watchlist.titleId))
		.where(eq(watchlist.userId, userId))
		.orderBy(
			sql`case ${watchlist.status} when 'want' then 0 when 'watching' then 1 else 2 end`,
			asc(watchlist.position)
		);
	return rows.map((r) => ({ ...r, media: r.media as Media, status: r.status as WatchStatus }));
}

/** Every list with its titles in order, for the account export. */
export async function exportLists(db: Db, userId: string) {
	const lists = await db
		.select({ id: watchLists.id, name: watchLists.name, createdAt: watchLists.createdAt })
		.from(watchLists)
		.where(eq(watchLists.userId, userId))
		.orderBy(asc(watchLists.createdAt), asc(watchLists.id));
	const out = [];
	for (const l of lists) {
		const full = await listWithTitles(db, userId, l.id);
		out.push({
			name: l.name,
			createdAt: l.createdAt,
			titles: (full?.titles ?? []).map((t) => ({
				media: t.media,
				tmdbId: t.tmdbId,
				title: t.title
			}))
		});
	}
	return out;
}
