# Fleet UI — favicon set

One convention for every hub's browser-tab icon: a **rounded-square tile** on the
fleet dark ground (`#0c110f`), a single **bright-teal glyph** (`#3fc2cc`, the
fleet dark-mode accent — favicons can't be theme-aware, so they always use the
dark treatment), plus at most one light detail (`#e3eae7`). `viewBox="0 0 24 24"`,
`rx="5"` on the tile. Ship inline as an SVG **data URI** — no separate asset file,
no static route:

```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,…">
```

The glyph says what the hub *is*, not a generic globe. Current set:

| Hub | Glyph | Meaning |
|-----|-------|---------|
| knowledge-hub | open book | documents / knowledge base |
| pi-hub (console) | radar rings + sweep | fleet monitoring console |
| dev-hub | bullseye | issue tracker |
| ai-hub | 4-point sparkle | AI agents |
| fin-hub | rising line + endpoint dot | financial trend |
| invest-hub | candlesticks | portfolio / markets |
| tool-hub | open-end wrench | tools / applets |
| excalibur | sword | offensive-security framework |

Raw SVGs (pre-URL-encoding) live in `favicons/*.svg`. To wire one into an app,
URL-encode it and drop it in the `href` above. The encoded strings actually in
use are in each frontend's `index.html` / `app/admin.html` / base template.
