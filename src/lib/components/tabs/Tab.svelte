<script lang="ts">
	import { getContext } from 'svelte';
	import { isTabsContext, TABS_CONTEXT_KEY } from './Group.svelte';

	let className = '';
	export { className as class };

	let [selected, notifySelected] = [false, (bool: boolean) => (selected = bool)];

	const TabsContext = getContext(TABS_CONTEXT_KEY);
	if (!isTabsContext(TabsContext)) throw Error('Invalid Tabs Context');

	const { tab } = TabsContext;
</script>

<button class={className} use:tab={notifySelected}>
	<slot {selected} />
</button>
