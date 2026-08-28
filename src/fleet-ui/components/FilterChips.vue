<script setup>
/* <FilterChips v-model="active" :options="['all','active','archived']" /> (§7).
   Single-select; the pressed chip inverts to --ink / --ground. */
defineProps({
  options: { type: Array, required: true },   // string[] or [{value,label}]
  modelValue: { type: [String, Number], default: null },
});
const emit = defineEmits(["update:modelValue"]);

function val(o) { return typeof o === "object" ? o.value : o; }
function label(o) { return typeof o === "object" ? o.label : o; }
</script>

<template>
  <div class="fleet-filter" role="group">
    <button
      v-for="o in options"
      :key="val(o)"
      :aria-pressed="String(val(o) === modelValue)"
      @click="emit('update:modelValue', val(o))"
    >{{ label(o) }}</button>
  </div>
</template>
