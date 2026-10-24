import { tmdbDemo } from '#lib/server/tmdb.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ demo: tmdbDemo() });
