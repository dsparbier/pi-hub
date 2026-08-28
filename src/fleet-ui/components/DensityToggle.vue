<script setup>
/* Compact-density toggle (§4 / U9). Orthogonal to theme. */
import { ref } from "vue";
import { getDensity, setDensity } from "../theme.js";

const compact = ref(getDensity() === "compact");
function onChange() { setDensity(compact.value ? "compact" : "comfortable"); }
</script>

<template>
  <label class="fleet-density-toggle">
    <input type="checkbox" v-model="compact" @change="onChange">
    Compact
  </label>
</template>
