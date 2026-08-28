<script setup>
/* <DataTable :columns="[{key:'name',label:'Name'},{key:'count',label:'Count',num:true}]"
              :rows="rows" /> (§7).
   Always wrapped in .fleet-scroll so it scrolls sideways instead of crushing.
   Use the #cell-<key> slot for custom cell rendering. */
defineProps({
  columns: { type: Array, required: true }, // [{ key, label, num }]
  rows: { type: Array, default: () => [] },
});
</script>

<template>
  <div class="fleet-scroll">
    <table>
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :class="{ num: c.num }">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i">
          <td v-for="c in columns" :key="c.key" :class="{ num: c.num }">
            <slot :name="`cell-${c.key}`" :row="r" :value="r[c.key]">{{ r[c.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
