<script setup>
/* <FleetIcon name="search" :size="18" /> — renders a vendored Lucide glyph. */
import { computed } from "vue";
import { svg } from "../icons/index.js";

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
});
const markup = computed(() => svg(props.name, props.size));
</script>

<template>
  <span class="fleet-icon" aria-hidden="true" v-html="markup" />
</template>

<style scoped>
.fleet-icon { display: inline-flex; }
.fleet-icon :deep(svg) { display: block; }
</style>
