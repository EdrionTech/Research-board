# Frame

Frame is the HUD panel: a neon outline with two chamfered corners, heavy brackets on the other two, a solid title tab and a tick rule with a system code.

- Provide `children`, optional `title` (short, uppercase), `code` (mono id like "// 0317"), `tone` (`red` default, `cyan` for data, `amber` for alerts, `neutral`), `striped` (hazard band under the header), `variant` (`notched` cuts all four corners) and `footer`.
- One `red` frame per screen leads; supporting frames are `cyan` or `neutral`.
- Frames sit `space-5` apart; never nest a frame inside a frame — use a Divider instead.
