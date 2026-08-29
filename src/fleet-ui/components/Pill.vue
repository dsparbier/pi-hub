<script setup>
/* <Pill tone="ok">verified</Pill> — Mono uppercase status pill (§7). */
defineProps({ tone: { type: String, default: "idle" } }); // ok | warn | stop | idle
</script>

<template>
  <span class="fleet-pill" :class="tone"><slot /></span>
</template>
