# Gauge

Gauge is an analog dial: steel bezel, ticked face, an amber needle and the exact value in a small screen at its centre. A red arc marks the redline; past it, the value turns red.

- Provide `label`, `value`, optional `min`, `max`, `unit`, `redline` (where the red zone starts, as a fraction 0–1), `format` and `size` (px, default 168).
- It is a meter for screen readers: they hear the formatted value and unit. Use two or three gauges side by side at most.
