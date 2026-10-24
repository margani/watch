// Press and hold a row, then drag it to its new place (#21). The owner wanted no arrows: hold a
// title, move it up or down. Touch, pen and mouse alike, on one list element and its rows.

/** Long enough that a tap or the start of a scroll never lifts a row. */
const HOLD_MS = 350;
/** A finger that moves this far before then is scrolling, not holding. */
const SLOP_PX = 8;
/** Near the top or bottom of the screen the page scrolls while dragging. */
const EDGE_PX = 72;
const SCROLL_PX = 12;

export interface HoldDragOptions {
	/** The rows, in the order shown. */
	rows: () => HTMLElement[];
	canStart: () => boolean;
	/** While dragging: the place the row would drop at, and how far to shift it to sit under the finger. */
	onMove: (from: number, to: number, dx: number, dy: number) => void;
	onDrop: (from: number, to: number) => void;
	onCancel: () => void;
}

export function holdToDrag(list: HTMLElement, o: HoldDragOptions) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let start = { x: 0, y: 0 };
	let held: HTMLElement | null = null;
	let active: {
		from: number;
		to: number;
		slots: { x: number; y: number; w: number; h: number }[];
		grab: { x: number; y: number };
		at: { x: number; y: number };
		frame: number;
	} | null = null;
	let suppressClick = false;

	const clearHold = () => {
		if (timer) clearTimeout(timer);
		timer = null;
	};

	function onDown(e: PointerEvent) {
		if (e.button !== 0 || active || !o.canStart()) return;
		held = (e.target as Element).closest('li');
		if (!held || !list.contains(held)) return;
		start = { x: e.clientX, y: e.clientY };
		timer = setTimeout(begin, HOLD_MS);
	}

	function onEarlyMove(e: PointerEvent) {
		if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP_PX) clearHold();
	}

	function begin() {
		timer = null;
		const rows = o.rows();
		const from = held ? rows.indexOf(held) : -1;
		if (from < 0) return;
		// Slots in page coordinates, so scrolling while dragging doesn't move them.
		const slots = rows.map((r) => {
			const b = r.getBoundingClientRect();
			return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height };
		});
		const at = { x: start.x + scrollX, y: start.y + scrollY };
		active = {
			from,
			to: from,
			slots,
			grab: { x: at.x - slots[from].x, y: at.y - slots[from].y },
			at,
			frame: requestAnimationFrame(edgeScroll)
		};
		suppressClick = true;
		navigator.vibrate?.(15);
		addEventListener('pointermove', onDrag);
		addEventListener('pointerup', onUp);
		addEventListener('pointercancel', onCancel);
		addEventListener('keydown', onKey);
		// Without this the finger scrolls the page instead of moving the row.
		addEventListener('touchmove', stopScroll, { passive: false });
		place();
	}

	function place() {
		if (!active) return;
		const { slots, at, grab } = active;
		let to = 0;
		let best = Infinity;
		slots.forEach((s, i) => {
			const d = Math.hypot(at.x - (s.x + s.w / 2), at.y - (s.y + s.h / 2));
			if (d < best) [best, to] = [d, i];
		});
		active.to = to;
		o.onMove(active.from, to, at.x - grab.x - slots[to].x, at.y - grab.y - slots[to].y);
	}

	function onDrag(e: PointerEvent) {
		if (!active) return;
		active.at = { x: e.clientX + scrollX, y: e.clientY + scrollY };
		place();
	}

	function edgeScroll() {
		if (!active) return;
		const y = active.at.y - scrollY;
		const step = y < EDGE_PX ? -SCROLL_PX : y > innerHeight - EDGE_PX ? SCROLL_PX : 0;
		if (step) {
			scrollBy(0, step);
			active.at.y += step;
			place();
		}
		active.frame = requestAnimationFrame(edgeScroll);
	}

	function end() {
		if (active) cancelAnimationFrame(active.frame);
		active = null;
		removeEventListener('pointermove', onDrag);
		removeEventListener('pointerup', onUp);
		removeEventListener('pointercancel', onCancel);
		removeEventListener('keydown', onKey);
		removeEventListener('touchmove', stopScroll);
		// The click that follows the release would open the title under the finger.
		setTimeout(() => (suppressClick = false), 0);
	}

	function onUp() {
		if (!active) return;
		const { from, to } = active;
		end();
		o.onDrop(from, to);
	}

	function onCancel() {
		end();
		o.onCancel();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}

	const stopScroll = (e: TouchEvent) => e.preventDefault();
	const onClick = (e: MouseEvent) => {
		if (!suppressClick) return;
		e.preventDefault();
		e.stopPropagation();
	};
	// A held link would otherwise open the browser's link menu, or start dragging the link itself.
	const onMenu = (e: Event) => {
		if (timer || active) e.preventDefault();
	};
	const noNativeDrag = (e: DragEvent) => e.preventDefault();

	list.addEventListener('pointerdown', onDown);
	list.addEventListener('pointermove', onEarlyMove);
	list.addEventListener('pointerup', clearHold);
	list.addEventListener('pointercancel', clearHold);
	list.addEventListener('click', onClick, true);
	list.addEventListener('contextmenu', onMenu);
	list.addEventListener('dragstart', noNativeDrag);
	return () => {
		clearHold();
		if (active) end();
		list.removeEventListener('pointerdown', onDown);
		list.removeEventListener('pointermove', onEarlyMove);
		list.removeEventListener('pointerup', clearHold);
		list.removeEventListener('pointercancel', clearHold);
		list.removeEventListener('click', onClick, true);
		list.removeEventListener('contextmenu', onMenu);
		list.removeEventListener('dragstart', noNativeDrag);
	};
}
