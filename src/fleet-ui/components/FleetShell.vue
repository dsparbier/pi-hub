<script setup>
/* FleetShell (§5–§7) — the outer layout every hub frontend wraps its app in.

   <FleetShell app-name="knowledge-hub" :context="[{text:'local',tone:'idle'}]" status="ok"
               :groups="navGroups" @nav="onNav">
     ...page content (goes in the default slot, inside .fleet-content > .wrap)...
   </FleetShell>

   Call initTheme() in main.js BEFORE createApp().mount() to avoid a flash.
*/
import { ref, onMounted } from "vue";
import { initTheme, getRail, toggleRail, bindShell } from "../theme.js";
import TitleBar from "./TitleBar.vue";
import SideMenu from "./SideMenu.vue";

defineProps({
  appName: { type: String, required: true },
  context: { type: Array, default: () => [] },
  status: { type: String, default: "" },
  groups: { type: Array, default: () => [] },
});
defineEmits(["nav"]);

const shell = ref(null);
const rail = ref(getRail() === "rail");
let api = null;

function onToggle() {
  if (window.matchMedia("(max-width:900px)").matches) { api && api.toggleDrawer(); return; }
  toggleRail(shell.value);
  rail.value = getRail() === "rail";
}

onMounted(() => {
  initTheme();                    // safe to call again; main.js should also call it
  api = bindShell(shell.value);
});
</script>

<template>
  <div ref="shell" class="fleet-shell" :data-rail="rail ? 'rail' : 'open'">
    <TitleBar
      :app-name="appName"
      :context="context"
      :status="status"
      @toggle-nav="onToggle"
    >
      <template #actions><slot name="actions" /></template>
    </TitleBar>

    <SideMenu :groups="groups" :rail="rail" @toggle-rail="onToggle" @nav="$emit('nav', $event)">
      <slot name="nav" />
    </SideMenu>
    <div class="fleet-scrim" @click="api && api.closeDrawer()" />

    <main class="fleet-content">
      <div class="wrap"><slot /></div>
    </main>
  </div>
</template>
