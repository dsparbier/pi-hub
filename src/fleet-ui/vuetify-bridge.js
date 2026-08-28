/* ============================================================================
   FLEET UI — vuetify-bridge.js
   For Vuetify apps (tool-hub). Maps the fleet tokens onto a
   createVuetify({ theme }) config covering ALL FIVE fleet themes, and keeps
   Vuetify's active theme in sync with the <html data-theme> attribute that
   theme.js drives.

   Usage (main.js):
     import { createVuetify } from "vuetify";
     import { vuetifyThemeConfig, syncVuetifyTheme } from "fleet-ui/vuetify-bridge.js";
     import { initTheme } from "fleet-ui/theme.js";
     initTheme();
     const vuetify = createVuetify({ theme: vuetifyThemeConfig });
     app.use(vuetify);
     syncVuetifyTheme(vuetify);      // call once after app.use

   Still import fleet-ui/tokens.css + app-shell.css BEFORE Vuetify's styles,
   and gut the Vite starter style.css (tool-hub memory).
   ============================================================================ */

/* colour sets — mirror tokens.css exactly. Vuetify keys on the left. */
const light = {
  dark: false,
  colors: {
    background: "#f4f7f6", surface: "#ffffff", "surface-bright": "#ffffff",
    "surface-variant": "#eaf0ef", "on-surface-variant": "#586662",
    primary: "#0d6d75", "on-primary": "#ffffff",
    secondary: "#586662",
    success: "#1c8a4b", warning: "#a9741a", error: "#b83a2b", info: "#0d6d75",
    "on-background": "#15201e", "on-surface": "#15201e",
  },
  variables: { "border-color": "#dde5e3", "theme-on-surface": "#15201e" },
};
const dark = {
  dark: true,
  colors: {
    background: "#0c110f", surface: "#141a18", "surface-bright": "#1c2422",
    "surface-variant": "#1c2422", "on-surface-variant": "#8b978f",
    primary: "#3fc2cc", "on-primary": "#062421",
    secondary: "#8b978f",
    success: "#48c17e", warning: "#dcab4d", error: "#e2735f", info: "#3fc2cc",
    "on-background": "#e3eae7", "on-surface": "#e3eae7",
  },
  variables: { "border-color": "#26302d", "theme-on-surface": "#e3eae7" },
};
const ambient = {
  dark: true,
  colors: {
    background: "#151109", surface: "#1e1810", "surface-bright": "#28211a",
    "surface-variant": "#28211a", "on-surface-variant": "#a2947c",
    primary: "#5fb2b0", "on-primary": "#0b1a19",
    secondary: "#a2947c",
    success: "#7bbf7a", warning: "#d9a557", error: "#d97a5f", info: "#5fb2b0",
    "on-background": "#ece0cb", "on-surface": "#ece0cb",
  },
  variables: { "border-color": "#332a1e", "theme-on-surface": "#ece0cb" },
};
const highContrast = {
  dark: false,
  colors: {
    background: "#ffffff", surface: "#ffffff", "surface-bright": "#ffffff",
    "surface-variant": "#f0f0f0", "on-surface-variant": "#333333",
    primary: "#006d77", "on-primary": "#ffffff",
    secondary: "#333333",
    success: "#0a6b34", warning: "#7a4a00", error: "#9a1b0e", info: "#006d77",
    "on-background": "#000000", "on-surface": "#000000",
  },
  variables: { "border-color": "#000000", "theme-on-surface": "#000000" },
};

/** feed straight into createVuetify({ theme: vuetifyThemeConfig }) */
export const vuetifyThemeConfig = {
  defaultTheme: "light",
  themes: {
    light,
    dark,
    ambient,
    "high-contrast": highContrast,
    // `system` is not a Vuetify theme — syncVuetifyTheme resolves it to
    // light/dark from the OS media query.
  },
};

/** resolve the fleet mode to a concrete Vuetify theme name */
export function resolveVuetifyTheme(fleetTheme) {
  if (fleetTheme && fleetTheme !== "system") return fleetTheme;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** keep vuetify.theme.global.name in step with <html data-theme> + the OS.
    Returns a disposer. */
export function syncVuetifyTheme(vuetify) {
  const apply = () => {
    const attr = document.documentElement.getAttribute("data-theme"); // null => system
    vuetify.theme.global.name.value = resolveVuetifyTheme(attr || "system");
  };
  apply();

  const mo = new MutationObserver(apply);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => apply();
  mq.addEventListener ? mq.addEventListener("change", onMq) : mq.addListener(onMq);

  return () => {
    mo.disconnect();
    mq.removeEventListener ? mq.removeEventListener("change", onMq) : mq.removeListener(onMq);
  };
}
