<script context="module" lang="ts">
	import type { Readable } from 'svelte/store';
	import type { Notifier, SelectedStyles, Toggleable } from '$lib/types';
	import { propsIn } from '$lib/utils/predicate';
	import { navigable, registrable, toggleable } from '$lib/stores';
	import { handleSelectedStyles, useSubscribers } from '$lib/utils';
	import { escapeKey, clickOutside } from '$lib/utils/definedListeners';

	export const MENU_CONTEXT_KEY = 'SVELTE-HEADLESS-MENU';

	function initMenu({ Toggleable }: MenuSetttings) {
		const { close, useButton, usePanel } = Toggleable;
		const Items = registrable<HTMLElement>([]);
		const { handlers, watchers, ...Navigable } = navigable({
			Items,
			Vertical: true,
			Wait: true,
			VerticalWait: true,
		});

		let button: HTMLElement;
		return {
			menu: (node: HTMLElement, styles?: SelectedStyles) => {
				const { handleKeyboard, handleKeyMatch } = handlers;
				const { watchNavigation, watchSelected } = watchers;

				makeFocusable(node).focus();
				const RestoreFocus = useFocusTrap(node);

				const DisposePanel = usePanel({
					panelElement: node,
					beforeClose: RestoreFocus,
					listenersBuilders: [escapeKey, clickOutside],
				});

				const stylesHandler = handleSelectedStyles(styles);
				Items.useItems((item) => stylesHandler({ unselected: item }));
				const DisposeSubscribers = useSubscribers(
					Items.watchers.watchNewItem((item) => stylesHandler({ unselected: item })),
					watchNavigation(),
					watchSelected((selected, previous) => {
						stylesHandler({ selected, unselected: previous });
					})
				);

				window.addEventListener('keydown', handleKeyboard);
				window.addEventListener('keydown', handleKeyMatch);
				return {
					destroy: () => {
						DisposePanel(), DisposeSubscribers(), RestoreFocus();
						window.removeEventListener('keydown', handleKeyboard);
						window.removeEventListener('keydown', handleKeyMatch);
						Navigable.onDestroy(({ Index, ManualIndex, Waiting, VerticalWaiting }) => {
							Index.set(0), ManualIndex.set(0);
							Waiting.set(true), VerticalWaiting.set(true);
						});
					},
				};
			},
			item: (node: HTMLElement, notifySelected: Notifier<boolean>) => {
				const registeredIndex = Items.register(node, removeFocusable);

				const StopIsSelected = useSubscribers(
					watchers.watchIsSelected(registeredIndex, notifySelected)
				);

				const selectNavIndex = handlers.handleSelection(registeredIndex);
				node.addEventListener('click', selectNavIndex);
				node.addEventListener('click', close);
				return {
					destroy: () => {
						StopIsSelected(), Items.unregister(node);
						node.removeEventListener('click', selectNavIndex);
						node.removeEventListener('click', close);
					},
				};
			},
			button: (node: HTMLElement) => {
				button = node;
				const DisposeButton = useButton(node, 'ArrowUp', 'ArrowDown');
				return {
					destroy: () => {
						DisposeButton();
					},
				};
			},
		};
	}

	export const isMenuContext = (val: unknown): val is MenuContext =>
		propsIn(val, 'Open', 'close', 'menu', 'item', 'button');

	interface MenuContext extends Pick<Toggleable, 'close'> {
		Open: Readable<boolean>;
		menu: (node: HTMLElement, styles?: SelectedStyles) => void;
		item: (node: HTMLElement, notifySelected: Notifier<boolean>) => void;
		button: (node: HTMLElement) => void;
	}

	interface MenuSetttings {
		Toggleable: Toggleable;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { derived } from 'svelte/store';
	import {
		makeFocusable,
		removeFocusable,
		useFocusTrap,
	} from '$lib/utils/focus-management';

	let open = false;
	const Toggleable = toggleable(open, (bool) => (open = bool));

	const { button, menu, item } = initMenu({ Toggleable });
	const Context = {
		Open: derived(Toggleable, ($Open) => $Open),
		close: Toggleable.close,
		button,
		menu,
		item,
	};

	setContext(MENU_CONTEXT_KEY, Context);
</script>

<slot {open} {button} {menu} />
{#if open}
	<slot name="menu" />
{/if}
