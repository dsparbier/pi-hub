<script setup>
/* <VerifyList title="All checks" :items="[{text:'…'},{text:'…',fail:true}]" /> (§7).
   ✓ markers in --ok, ✗ (fail:true) in --stop. */
defineProps({
  title: { type: String, default: "" },
  items: { type: Array, default: () => [] }, // [{ text, fail }]
});
</script>

<template>
  <div class="fleet-verify">
    <h3 v-if="title">{{ title }}</h3>
    <ul>
      <li v-for="(it, i) in items" :key="i" :class="{ x: it.fail }">{{ it.text }}</li>
    </ul>
  </div>
</template>
