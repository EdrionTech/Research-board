# MediaBar

MediaBar is the now-playing strip: track info, transport orbs with a big blue play orb, seek bar and volume.

- Provide `title`, `artist`, optional `cover` (image URL), `duration` and `position` in seconds, `playing`, `onPlayToggle`.
- Dock it to the bottom of a Window or the screen; one per app.
- It adapts to its own width: below 700px it stacks and drops the volume slider (phones use hardware volume); below 380px shuffle and repeat hide too.
