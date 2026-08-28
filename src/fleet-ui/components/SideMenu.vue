<script setup>
/* Side-Menu (§6). Give it `groups` (nav data) or fill the default slot with
   <NavItem>s directly. The footer (theme switch + density + collapse) is fixed. */
import ThemeSwitch from "./ThemeSwitch.vue";
import DensityToggle from "./DensityToggle.vue";
import NavItem from "./NavItem.vue";
import FleetIcon from "./FleetIcon.vue";

defineProps({
  /** [{ label, items: [{ icon, label, href, count, active }] }] */
  groups: { type: Array, default: () => [] },
  rail: { type: Boolean, default: false },
});
defineEmits(["toggle-rail", "nav"]);
</script>

<template>
  <nav class="fleet-sidemenu" aria-label="Primary">
    <slot>
      <template v-for="g in groups" :key="g.label">
        <div class="group-label">{{ g.label }}</div>
        <NavItem
          v-for="it in g.items"
          :key="it.label"
          v-bind="it"
          @click="$emit('nav', it)"
        />
      </template>
    </slot>

    <div class="footer">
      <ThemeSwitch :cycle="rail" />
      <DensityToggle v-if="!rail" />
      <button class="fleet-nav-item" @click="$emit('toggle-rail')">
        <span class="icon"><FleetIcon name="panel-left" /></span>
        <span class="label">Collapse</span>
      </button>
    </div>
  </nav>
</template>
