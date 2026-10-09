# NOIR logo source

The mark is a stylised **orrery** — a polished gold sphere held inside nested
orbital rings, layered so the rings pass in front of and behind each other.

## Provenance

The base render was generated with Higgsfield (`z_image`, text-to-image, 1:1,
2048px). The raw output is kept here as `orrery-source-2048.png`.

Model output is not shippable as-is, so `finish.mjs` does the production work:

1. **Crushes the studio ground to `#050505`.** The render came on a grey
   backdrop with a floor plane; a luminance ramp pushes the dark greys to the
   brand black while leaving the gold untouched.
2. **Auto-crops to the subject and recentres.** It finds the bounding box of the
   solid gold (thresholded high enough to ignore the dimmer floor reflection),
   squares it, adds 14% breathing room, and reframes — so the mark fills the
   icon instead of floating above a ground plane.
3. **Emits the right formats.** An opaque RGB icon (the App Store rejects icons
   with an alpha channel) and a separate alpha splash so `resizeMode: contain`
   sits seamlessly on `#050505`.
4. **Emits 40px and 120px proofs.** Always look at these before shipping a
   change — 40px is the Spotlight size and is where detail collapses.

## Regenerate

```bash
node logo-source/finish.mjs logo-source/orrery-source-2048.png assets final
```

Then rename the outputs onto `assets/icon.png`, `assets/noir-logo.png` and
`assets/noir-splash.png`.

## Known trade-off

This mark is deliberately layered, which costs some legibility at 40px — the
concentric rings soften together, though the sphere-in-orbits form still reads.
A simpler mark would be sharper when small; this one was chosen for depth.

The PNGs are ~1MB because the render carries fine gradient noise that does not
compress well. That is fine for an app icon (it is not loaded per-screen), but
it is why these are larger than a flat vector mark would be.

`previous-*.png` are the earlier icons, kept for reference. This folder sits
outside `assets/` on purpose — `assetBundlePatterns` would otherwise ship it
inside the app.
