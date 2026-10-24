import { expect, signUp, test } from './helpers';

// The viewer's own order in each tab (#21). A touch screen, so a finger's hold and drag are real
// pointer events, as on a phone.
test.use({ hasTouch: true });
for (const width of [390, 1280])
	test(`titles can be put in my own order, and keep it (${width} px)`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await signUp(page);
		const add = async (path: string, status: 'Want to watch' | 'Watching') => {
			await page.goto(path);
			const put = page.waitForResponse(
				(r) => r.url().endsWith(`/api${path}`) && r.request().method() === 'PUT'
			);
			await page.getByRole('button', { name: status, exact: true }).click();
			expect((await put).status()).toBe(200);
		};
		await add('/movie/900001', 'Want to watch');
		await add('/movie/900002', 'Want to watch');
		await add('/movie/900003', 'Want to watch');

		await page.goto('/?tab=want');
		const rows = page.getByRole('list').last().getByRole('heading', { level: 2 });
		const names = ['Lighthouse Road', 'Paper Comets', 'The Lighthouse Keeper’s Clock'];
		// The newest on top to begin with.
		await expect(rows).toHaveText(names);

		const moved = () =>
			page.waitForResponse((r) => r.url().endsWith('/move') && r.request().method() === 'POST');
		const row = (title: string) =>
			page.locator('li', { has: page.getByRole('heading', { name: title }) });
		const centre = async (title: string) => {
			const b = (await row(title).boundingBox())!;
			return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		};
		// No arrows: a title is held, then dragged (the owner's choice).
		await expect(page.getByRole('button', { name: /Move|Reorder/ })).toHaveCount(0);

		// Mouse: hold the last title, drag it to the top.
		let done = moved();
		let from = await centre(names[2]);
		let to = await centre(names[0]);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.waitForTimeout(500);
		await page.mouse.move(to.x, to.y - 10, { steps: 8 });
		await page.mouse.up();
		expect(JSON.parse((await done).request().postData()!)).toEqual({ to: 0 });
		expect((await done).status()).toBe(204);
		await expect(rows).toHaveText([names[2], names[0], names[1]]);
		// The release didn't open a title.
		await expect(page).toHaveURL(/\/\?tab=want$/);

		// A finger: hold Paper Comets, drag it up one place, without the page scrolling instead.
		const cdp = await page.context().newCDPSession(page);
		const touch = (type: string, p?: { x: number; y: number }) =>
			cdp.send('Input.dispatchTouchEvent', {
				type,
				touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y) }] : []
			});
		done = moved();
		from = await centre(names[1]);
		to = await centre(names[0]);
		const scrolled = await page.evaluate(() => scrollY);
		await touch('touchStart', from);
		await page.waitForTimeout(500);
		for (let k = 1; k <= 8; k++)
			await touch('touchMove', {
				x: from.x + ((to.x - from.x) * k) / 8,
				y: from.y + ((to.y - 10 - from.y) * k) / 8
			});
		await touch('touchEnd');
		expect(JSON.parse((await done).request().postData()!)).toEqual({ to: 1 });
		await expect(rows).toHaveText([names[2], names[1], names[0]]);
		expect(await page.evaluate(() => scrollY)).toBe(scrolled);
		await expect(page).toHaveURL(/\/\?tab=want$/);

		// A short tap still opens the title.
		from = await centre(names[0]);
		await touch('touchStart', from);
		await touch('touchEnd');
		await expect(page).toHaveURL(/\/movie\/900003$/);
		await page.goBack();
		await expect(rows).toHaveText([names[2], names[1], names[0]]);

		// Keyboard: Alt and the arrow keys move the focused title.
		done = moved();
		await row(names[0]).getByRole('link').focus();
		await page.keyboard.press('Alt+ArrowUp');
		expect(JSON.parse((await done).request().postData()!)).toEqual({ to: 1 });
		await expect(rows).toHaveText([names[2], names[0], names[1]]);
		await expect(row(names[0]).getByRole('link')).toBeFocused();
		done = moved();
		await page.keyboard.press('Alt+ArrowDown');
		expect((await done).status()).toBe(204);
		await expect(rows).toHaveText([names[2], names[1], names[0]]);

		// Kept after a reload.
		await page.reload();
		await expect(rows).toHaveText([names[2], names[1], names[0]]);

		// A rating leaves it in its place; moving to another tab puts it on top there.
		await page.goto('/movie/900003');
		const put = page.waitForResponse(
			(r) => r.url().endsWith('/api/movie/900003') && r.request().method() === 'PUT'
		);
		await page.getByLabel('My rating').selectOption('7');
		expect((await put).status()).toBe(200);
		await page.goto('/?tab=want');
		await expect(rows).toHaveText([names[2], names[1], names[0]]);

		await add('/tv/900101', 'Watching');
		await add('/movie/900002', 'Watching');
		await page.goto('/?tab=watching');
		await expect(rows).toHaveText(['Paper Comets', 'Harbour Lights']);
		await page.goto('/?tab=want');
		await expect(rows).toHaveText([names[2], names[0]]);
	});
