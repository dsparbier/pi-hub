<script setup>
/* One Side-Menu row (§6). Renders as <a> (href) or <button> (click).
   Pass `active` for the accent left-bar treatment. */
import FleetIcon from "./FleetIcon.vue";

defineProps({
  icon: { type: String, default: "" },
  label: { type: String, required: true },
  href: { type: String, default: "" },
  count: { type: [Number, String], default: null },
  active: { type: Boolean, default: false },
});
defineEmits(["click"]);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    class="fleet-nav-item"
    :href="href || undefined"
    :aria-current="active ? 'page' : undefined"
    :title="label"
    @click="$emit('click', $event)"
  >
    <span v-if="icon" class="icon"><FleetIcon :name="icon" /></span>
    <span class="label">{{ label }}</span>
    <span v-if="count !== null" class="count">{{ count }}</span>
  </component>
</template>
