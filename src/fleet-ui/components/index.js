/* Barrel for the Vue 3 reference components. Optional convenience:
     import { FleetShell, StatTile } from "fleet-ui/components";
   or install them all:
     import FleetUI from "fleet-ui/components";
     app.use(FleetUI);
*/
import FleetShell from "./FleetShell.vue";
import TitleBar from "./TitleBar.vue";
import SideMenu from "./SideMenu.vue";
import NavItem from "./NavItem.vue";
import ThemeSwitch from "./ThemeSwitch.vue";
import DensityToggle from "./DensityToggle.vue";
import StatTile from "./StatTile.vue";
import AccentCard from "./AccentCard.vue";
import Pill from "./Pill.vue";
import FilterChips from "./FilterChips.vue";
import DataTable from "./DataTable.vue";
import VerifyList from "./VerifyList.vue";
import FleetIcon from "./FleetIcon.vue";

export {
  FleetShell, TitleBar, SideMenu, NavItem, ThemeSwitch, DensityToggle,
  StatTile, AccentCard, Pill, FilterChips, DataTable, VerifyList, FleetIcon,
};

export default {
  install(app) {
    const all = {
      FleetShell, TitleBar, SideMenu, NavItem, ThemeSwitch, DensityToggle,
      StatTile, AccentCard, Pill, FilterChips, DataTable, VerifyList, FleetIcon,
    };
    for (const [name, comp] of Object.entries(all)) app.component(name, comp);
  },
};
