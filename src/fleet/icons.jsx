/* Inline Lucide glyphs from the vendored fleet_ui subset, as a React component. */
import { svg, THEME_ICON } from '../fleet-ui/icons/index.js'

export { THEME_ICON }

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
