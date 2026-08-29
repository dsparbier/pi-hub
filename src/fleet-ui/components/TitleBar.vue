<script setup>
/* Title-Bar (§5). App name + fleet mark + optional context pills + status dot.
   The theme switcher is deliberately NOT here — it lives in the Side-Menu. */
import FleetIcon from "./FleetIcon.vue";
import Pill from "./Pill.vue";

defineProps({
  appName: { type: String, required: true },
  /** [{ text, tone }] — e.g. { text: 'pi_hub', tone: 'idle' } */
  context: { type: Array, default: () => [] },
  /** 'ok' | 'warn' | 'stop' | '' */
  status: { type: String, default: "" },
});
defineEmits(["toggle-nav"]);
</script>

<template>
  <header class="fleet-titlebar">
    <button class="fleet-iconbtn" aria-label="Toggle navigation" @click="$emit('toggle-nav')">
      <FleetIcon name="menu" />
    </button>
    <span class="mark" aria-hidden="true" />
    <span class="app-name">{{ appName }}</span>
    <Pill v-for="c in context" :key="c.text" :tone="c.tone || 'idle'">{{ c.text }}</Pill>
    <span class="spacer" />
    <slot name="actions" />
    <span
      class="status-dot"
      :class="status"
      :title="status ? `health: ${status}` : 'health'"
    />
  </header>
</template>
