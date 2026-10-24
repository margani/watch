import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
	it('keeps same-site paths', () => {
		expect(safeNext('/book/abc?x=1')).toBe('/book/abc?x=1');
	});

	it('rejects other sites and junk', () => {
		for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', '', null]) {
			expect(safeNext(bad)).toBe('/');
		}
	});
});
