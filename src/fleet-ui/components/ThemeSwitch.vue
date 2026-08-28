<script setup>
/* 5-way theme switch (§4). Lives in the Side-Menu footer. In rail mode the
   parent CSS stacks the buttons; pass :cycle to render one cycling button. */
import { ref } from "vue";
import { THEMES, getTheme, setTheme, cycleTheme } from "../theme.js";
import { THEME_ICON } from "../icons/index.js";
import FleetIcon from "./FleetIcon.vue";

defineProps({ cycle: { type: Boolean, default: false } });
const current = ref(getTheme());

function pick(t) { current.value = setTheme(t); }
function next() { current.value = cycleTheme(); }
</script>

<template>
  <button
    v-if="cycle"
    class="fleet-nav-item"
    :title="`Theme: ${current}`"
    @click="next"
  >
    <span class="icon"><FleetIcon :name="THEME_ICON[current]" /></span>
    <span class="label">{{ current }}</span>
  </button>

  <div v-else class="fleet-theme-switch" role="group" aria-label="Theme">
    <button
      v-for="t in THEMES"
      :key="t"
      :aria-pressed="String(t === current)"
      :title="t"
      @click="pick(t)"
    >
      <FleetIcon :name="THEME_ICON[t]" :size="14" />
    </button>
  </div>
</template>
