# 0.4.11 selection scale fix

- Fixed PDF text annotation rectangles becoming scale-dependent when created at zoom levels other than the accidental 170% alignment.
- Set pdf.js text-layer `--scale-factor` explicitly and keep canvas/text-layer/page CSS sizes at the same floating-point viewport size instead of mixing rounded dimensions.
- Split same-baseline selected text into separate visual runs when a large horizontal gap or two-column gutter is detected, avoiding annotation boxes that cover non-text areas or span columns.
- Made cross-column leak filtering more aggressive for two-column papers while preserving deliberate selections when possible.
