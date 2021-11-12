import type { Readable } from 'svelte/store';
import type { Navigable, Notifiable } from '$lib/types';
import { derived, get, readable, writable } from 'svelte/store';
import { isBoolean } from '$lib/utils/predicate';
import { useSubscribers } from '$lib/utils';

export function navigable({ Items, ...Optional }: NavigableSettings): Navigable {
	let {
		Index = writable(0),
		Manual = readable(false),
		Vertical = readable(false),
		Wait = readable(false),
		VerticalWait = readable(false),
		onChange = () => void 0,
	} = Optional;

	if (isBoolean(Manual)) Manual = readable(Manual);
	if (isBoolean(Vertical)) Vertical = readable(Vertical);
	if (isBoolean(Wait)) Wait = readable(Wait);
	if (isBoolean(VerticalWait)) VerticalWait = readable(VerticalWait);

	const ManualIndex = writable(get(Index));
	const Waiting = writable(get(Wait));
	const VerticalWaiting = writable(get(VerticalWait));
	const Selected = derived([Items, Index, Waiting], ([$Items, $Index, $Waiting]) => {
		return $Waiting ? undefined : $Items[$Index];
	});
	const Active = derived([Items, ManualIndex], ([$Items, $ManualIndex]) => {
		return $Items[$ManualIndex];
	});

	function isOverflowed(
		index: number,
		direction: 'ASCENDING' | 'DESCENDING',
		length: number
	) {
		if (direction === 'ASCENDING') return index + 1 === length;
		if (direction === 'DESCENDING') return index - 1 === -1;
		throw new Error('Invalid Direction');
	}

	function getTargetIndex() {
		return get(Manual as Readable<boolean>) ? ManualIndex : Index;
	}

	function navigate(direction: 'ASCENDING' | 'DESCENDING') {
		const TargetIndex = getTargetIndex();
		return function (
			callback: (state: {
				index: number;
				isOverflowed: boolean;
				isWaiting: boolean;
				isWaitingVertical: boolean;
			}) => number
		) {
			TargetIndex.update((index) => {
				const length = get(Items).length;
				const isWaiting = get(Waiting);
				const isWaitingVertical = get(VerticalWaiting);
				return callback({
					index,
					isOverflowed: isOverflowed(index, direction, length),
					isWaiting,
					isWaitingVertical,
				});
			});

			if (TargetIndex !== ManualIndex) Waiting.set(false);
		};
	}

	function goFirst() {
		return 0;
	}

	function goLast() {
		return get(Items).length - 1;
	}

	function goPrev(ctrlKey: boolean) {
		navigate('DESCENDING')(({ index, isOverflowed, isWaiting, isWaitingVertical }) => {
			if (ctrlKey) return goFirst();
			if (isWaiting && isWaitingVertical) return VerticalWaiting.set(false), goLast();

			return isOverflowed ? goLast() : index - 1;
		});
	}

	function goNext(ctrlKey: boolean) {
		navigate('ASCENDING')(({ index, isOverflowed, isWaiting, isWaitingVertical }) => {
			if (ctrlKey) return goLast();
			if (isWaiting && isWaitingVertical) return VerticalWaiting.set(false), goFirst();

			return isOverflowed ? goFirst() : index + 1;
		});
	}

	return {
		handlers: {
			handleKeyboard: (event) => {
				const { key, ctrlKey } = event;
				const isVertical = get(Vertical as Readable<boolean>);
				const cases = {
					vertical: {
						ArrowUp: goPrev,
						ArrowDown: goNext,
					},
					horizontal: {
						ArrowRight: goNext,
						ArrowLeft: goPrev,
					},
				};

				// @ts-ignore
				const action = cases[isVertical ? 'vertical' : 'horizontal'][key];
				if (action && typeof action === 'function') {
					event.preventDefault(), action(ctrlKey);
				}
			},
			handleSelection: (index) => {
				return function () {
					Index.set(index), ManualIndex.set(index);
					Waiting.set(false), VerticalWaiting.set(false);
				};
			},
			handleKeyMatch: ({ key }) => {
				get(Items).some((item, index) => {
					const lower = item.innerText.toLowerCase();
					if (lower.startsWith(key.toLowerCase())) {
						Index.set(index), ManualIndex.set(index);
						Waiting.set(false), VerticalWaiting.set(false);
					}
				});
			},
		},
		watchers: {
			watchNavigation: ({ indexCb, manualIndexCb } = {}) => {
				const IndexWaitingSelected = derived(
					[Index, Selected, Waiting],
					([$Index, $Selected, $Waiting]) =>
						[$Index, $Selected, $Waiting] as [number, HTMLElement | undefined, boolean]
				);

				const ManualNWaiting = derived(
					[ManualIndex, Waiting, Manual as Readable<boolean>, Active],
					([$Idx, $Wait, $Manual, $Active]) =>
						[$Idx, $Wait, $Manual, $Active] as [number, boolean, boolean, HTMLElement]
				);

				return useSubscribers(
					IndexWaitingSelected.subscribe(([index, selected, waiting]) => {
						if (!waiting && selected) selected.focus();
						if (!waiting && indexCb) {
							indexCb(index), onChange(index);
						}
					}),
					ManualNWaiting.subscribe(([index, waiting, isManual, active]) => {
						if (active && (!waiting || isManual)) active.focus();
						if (!waiting && manualIndexCb) manualIndexCb(index);
					})
				);
			},
			watchActive: (callback) => {
				let previous: HTMLElement;
				return Active.subscribe((active) => {
					callback(active, previous), (previous = active);
				});
			},
			watchSelected: (callback) => {
				let previous: HTMLElement | undefined;
				return Selected.subscribe((selected) => {
					if (selected) callback(selected, previous);
					previous = selected;
				});
			},
		},
		status: {
			IsSelected: (index) => {
				return derived(Index, ($Index) => {
					return $Index === index;
				});
			},
		},
		lifecycle: {
			onDestroy: (callback) => {
				callback({ Index, ManualIndex, Waiting, VerticalWaiting });
			},
		},
	};
}

interface NavigableSettings {
	Items: Readable<HTMLElement[]>;
	Index?: Notifiable<number>;
	Manual?: Readable<boolean> | boolean;
	Vertical?: Readable<boolean> | boolean;
	Wait?: Readable<boolean> | boolean;
	VerticalWait?: Readable<boolean> | boolean;
	onChange?: (index: number) => void;
}
