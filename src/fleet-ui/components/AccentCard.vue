<script setup>
/* Accent-edged state card (§7). Left border encodes state.

   <AccentCard state="ok" title="example.db" :facts="{ rows: 18402, target: 'local' }">
     free-form body via the default slot
   </AccentCard>
*/
defineProps({
  state: { type: String, default: "idle" },   // ok | warn | stop | idle
  title: { type: String, default: "" },
  facts: { type: Object, default: null },      // { label: value, ... }
});
</script>

<template>
  <div class="fleet-card" :class="state">
    <div v-if="title" class="title">{{ title }}</div>
    <dl v-if="facts" class="facts">
      <template v-for="(v, k) in facts" :key="k">
        <dt>{{ k }}</dt><dd>{{ v }}</dd>
      </template>
    </dl>
    <div v-if="$slots.default"><slot /></div>
  </div>
</template>
