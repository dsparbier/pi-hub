<script setup>
/* <StatTile k="Documents" :value="1284" unit="" sub="+12 this week" /> (§7).
   Wrap several in a .fleet-tiles grid. */
defineProps({
  k: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: "" },
  sub: { type: String, default: "" },
});
</script>

<template>
  <div class="fleet-tile">
    <div class="k">{{ k }}</div>
    <div class="v">{{ value }}<small v-if="unit"> {{ unit }}</small></div>
    <div v-if="sub" class="sub">{{ sub }}</div>
  </div>
</template>
