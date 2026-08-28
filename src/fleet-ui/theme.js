/* ============================================================================
   FLEET THEME BOOTSTRAP — theme.js  (ES module)
   Fleet UI Standard §4. Framework-agnostic.

   - Theme lives in the `data-theme` attribute on <html>; `system` = no attribute.
   - Density is a separate axis: `data-density="compact"` on <html>.
   - Side-menu collapse ("rail") lives in `data-rail` on the shell element.
   Persistence keys: fleet.theme | fleet.density | fleet.sidemenu

   Call initTheme() BEFORE first paint (inline in <head> for static pages, or in
   main.js before mount for Vue). For static pages, theme-inline.min.js does the
   theme+density part in the smallest possible form.
   ============================================================================ */

export const THEMES = ["system", "light", "dark", "ambient", "high-contrast"];
export const DENSITIES = ["comfortable", "compact"];

const K_THEME = "fleet.theme";
const K_DENSITY = "fleet.density";
const K_RAIL = "fleet.sidemenu";      // "open" | "rail"

function lsGet(k, fallback) {
  try { return localStorage.getItem(k) || fallback; } catch (e) { return fallback; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { /* private mode / blocked */ }
}

/* ---- theme ---- */
export function applyTheme(t) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
export function getTheme() {
  const t = lsGet(K_THEME, "system");
  return THEMES.includes(t) ? t : "system";
}
export function setTheme(t) {
  if (!THEMES.includes(t)) t = "system";
  applyTheme(t);
  lsSet(K_THEME, t);
  return t;
}
/** cycle to the next theme in THEMES order — handy for a rail-mode single button */
export function cycleTheme() {
  const i = THEMES.indexOf(getTheme());
  return setTheme(THEMES[(i + 1) % THEMES.length]);
}

/* ---- density ---- */
export function applyDensity(d) {
  if (d === "compact") document.documentElement.setAttribute("data-density", "compact");
  else document.documentElement.removeAttribute("data-density");
}
export function getDensity() {
  const d = lsGet(K_DENSITY, "comfortable");
  return DENSITIES.includes(d) ? d : "comfortable";
}
export function setDensity(d) {
  if (!DENSITIES.includes(d)) d = "comfortable";
  applyDensity(d);
  lsSet(K_DENSITY, d);
  return d;
}

/* ---- side-menu rail ---- */
export function getRail() {
  return lsGet(K_RAIL, "open") === "rail" ? "rail" : "open";
}
export function setRail(state, shellEl) {
  const s = state === "rail" ? "rail" : "open";
  lsSet(K_RAIL, s);
  const el = shellEl || document.querySelector(".fleet-shell");
  if (el) el.setAttribute("data-rail", s);
  return s;
}
export function toggleRail(shellEl) {
  return setRail(getRail() === "rail" ? "open" : "rail", shellEl);
}

/* ---- one-shot init ---- */
export function initTheme() {
  const theme = getTheme();
  const density = getDensity();
  applyTheme(theme);
  applyDensity(density);
  return { theme, density, rail: getRail() };
}

/* ---- titlebar scroll shadow + <=900px drawer helpers (optional) ---- */
export function bindShell(shellEl) {
  const el = shellEl || document.querySelector(".fleet-shell");
  if (!el) return;
  el.setAttribute("data-rail", getRail());

  const bar = el.querySelector(".fleet-titlebar");
  const content = el.querySelector(".fleet-content") || window;
  if (bar) {
    const onScroll = () => {
      const y = content === window ? window.scrollY : content.scrollTop;
      bar.classList.toggle("scrolled", y > 2);
    };
    (content === window ? window : content).addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  return {
    openDrawer: () => el.setAttribute("data-drawer", "open"),
    closeDrawer: () => el.removeAttribute("data-drawer"),
    toggleDrawer: () =>
      el.getAttribute("data-drawer") === "open"
        ? el.removeAttribute("data-drawer")
        : el.setAttribute("data-drawer", "open"),
  };
}

/* Re-render nothing here — a `system`-mode page follows the OS live via the
   media query, so there is no listener to wire for that. */
