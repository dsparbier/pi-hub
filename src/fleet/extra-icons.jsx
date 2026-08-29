/* Extra inline Lucide glyphs the agent views need that aren't in the vendored
   fleet_ui subset (src/fleet-ui/icons/index.js). Same contract as
   src/fleet/icons.jsx's <Icon>: { name, size = 18, className }.

   Names already present in the base set fall through to it, so agent components
   can import a single <Icon> from here for everything.

   CROSS-PROJECT NOTE: request these 9 glyphs be upstreamed into
   ~/projects/_fleet/fleet_ui/icons/index.js. Once that lands, delete this file
   and repoint the agent imports at ../fleet/icons.jsx. */
import { GLYPHS as BASE_GLYPHS } from '../fleet-ui/icons/index.js'

const EXTRA_GLYPHS = {
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'cpu': '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  'hard-drive': '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
  'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
  'square': '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
}

const GLYPHS = { ...BASE_GLYPHS, ...EXTRA_GLYPHS }

function svg(name, size) {
  const inner = GLYPHS[name]
  if (!inner) return ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
  )
}

export function Icon({ name, size = 18, className }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg(name, size) }}
    />
  )
}
