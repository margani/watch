import { describe, expect, it } from 'vitest';
import { listName } from './lists.ts';

describe('listName', () => {
	it('trims and keeps single spaces', () => {
		expect(listName('  Coast \n  marathon ')).toBe('Coast marathon');
	});
	it('refuses empty, too long and non-text names', () => {
		expect(listName('   ')).toBeNull();
		expect(listName('x'.repeat(81))).toBeNull();
		expect(listName('x'.repeat(80))).toBe('x'.repeat(80));
		expect(listName(null)).toBeNull();
		expect(listName(5)).toBeNull();
	});
});
