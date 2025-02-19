<script context="module" lang="ts">
	import type { Readable } from 'svelte/store';
	import type { Notifiable, Notifier, SelectedStyles } from '$lib/types';
	import { navigable, notifiable, registrable } from '$lib/stores';
	import { useSubscribers, handleSelectedStyles } from '$lib/utils';
	import { isObject } from '$lib/utils/predicate';
	import { makeFocusable, removeFocusable } from '$lib/utils/focus-management';

	export const TABS_CONTEXT_KEY = 'SVELTE-HEADLESS-TABS';

	function initTabs({ Index, Manual, Vertical }: TabsSettings) {
		const Tabs = registrable<HTMLElement>([]);
		const Panels = registrable<number>([]);
		const config = { Items: Tabs, Index, Manual, Vertical };
		const { handlers, watchers, ...Navigable } = navigable(config);

		return {
			tabs: (node: HTMLElement, styles?: SelectedStyles) => {
				const { handleKeyboard, createManualBlurHandler } = handlers;
				const { watchNavigation, watchSelected } = watchers;

				const stylesHandler = handleSelectedStyles(styles);
				Tabs.useItems((tab) => stylesHandler({ unselected: tab }));

				const DisposeSubscribers = useSubscribers(
					Tabs.watchers.watchNewItem((newTab) => {
						stylesHandler({ unselected: newTab });
					}),
					watchNavigation(),
					watchSelected((selected, previous) => {
						stylesHandler({ selected, unselected: previous });
						if (previous) removeFocusable(previous);
						makeFocusable(selected);
					})
				);

				const { handleManualBlur, removeInternal } = createManualBlurHandler(node);
				node.addEventListener('keydown', handleKeyboard);
				node.addEventListener('focusin', handleManualBlur);
				return {
					destroy: () => {
						DisposeSubscribers;
						node.removeEventListener('keydown', handleKeyboard);
						node.removeEventListener('focusin', handleManualBlur);
						removeInternal();
					},
				};
			},
			tab: (node: HTMLElement, notifySelected: Notifier<boolean>) => {
				const registeredIndex = Tabs.register(node, removeFocusable);

				const StopSelected = watchers.watchIsSelected(registeredIndex, notifySelected);

				const selectTab = handlers.handleSelection(registeredIndex);
				node.addEventListener('click', selectTab);
				return {
					destroy: () => {
						Tabs.unregister(node), StopSelected();
						node.removeEventListener('click', selectTab);
					},
				};
			},
			panel: {
				register: Panels.register,
				unregister: Panels.unregister,
			},
		};
	}

	interface TabsSettings {
		Index: Notifiable<number>;
		Manual: Readable<boolean>;
		Vertical: Readable<boolean>;
	}

	export function isTabsContext(val: unknown): val is TabsContext {
		if (!isObject(val)) return false;
		if (!('Index' in val)) return false;
		if (!('panel' in val)) return false;
		return 'tabs' in val && 'tab' in val;
	}

	interface TabsContext extends ReturnType<typeof initTabs> {
		Index: Notifiable<number>;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let current = 0;
	export let manual = false;
	export let vertical = false;
	export let onChange: (index: number) => void = () => void 0;

	const Index = notifiable(current, (num) => (current = num));
	const Manual = writable(manual);
	const Vertical = writable(vertical);

	$: Index.set(current);
	$: Vertical.set(vertical);
	$: Manual.set(manual);

	$: if (onChange) onChange(current);

	const { tabs, tab, panel } = initTabs({ Index, Vertical, Manual });
	setContext(TABS_CONTEXT_KEY, { Index, tabs, tab, panel });
</script>

<slot {current} {tabs} />
