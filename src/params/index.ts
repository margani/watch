import { defineParams } from '@sveltejs/kit/params';

// Titles live at the root (/movie/1, /tv/2), so only these two words may open one.
export const params = defineParams({
	media: (param) => (param === 'movie' || param === 'tv' ? param : undefined)
});
