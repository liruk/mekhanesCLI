---
name: kawaii-spice-style
description: Apply the reusable Mekhaneth approved anime-rendering language inferred from the bundled Kawaii Spice, Purifier, and Mithleash references. Use for image generation or style transfer that mentions Kawaii Spice, カワイイスパイス, Mekhaneth approved style, 合格画風, or asks to preserve this polished anime finish while changing character, palette, costume, pose, composition, lighting, material, or scene.
---

# Mekhaneth Approved Style

Create polished anime illustrations using the cross-reference traits in `references/style-spec.md`. Treat all bundled images as evidence for a rendering language, never as automatic subject specifications.

## Workflow

1. Read `references/style-spec.md` before shaping the prompt.
2. Use the `imagegen` skill and its built-in image-generation path.
3. Label every bundled image used as a **style reference image**.
4. Choose references by rendering need; do not always pass all three:
   - `assets/base.jpg`: soft, dim, atmospheric rendering and flowing organic forms.
   - `assets/purifier.png`: warm interior light, restrained realism, cloth and hosiery.
   - `assets/mithleash.png`: bright outdoor light, crisp color, glossy mechanical materials.
5. Preserve the user's character, anatomy, palette, costume, pose, setting, framing, and lighting unless the user asks to borrow them.
6. Translate only the invariant core and relevant conditional traits into the imagegen prompt schema. Add the leakage guards from the specification.
7. Inspect the result for clean anime facial design, smooth modeled form, selective edge hierarchy, material-specific highlights, controlled glow, and subject fidelity. Iterate with one targeted correction when needed.

## Prompt Core

```text
Style/medium: polished high-finish anime illustration; clean simplified facial design combined with smoothly modeled forms; restrained line presence; selective crisp detail around eyes, lashes, and important material boundaries
Rendering: broad controlled value gradients, coherent volumes, intentional edge hierarchy, material-specific specular response, luminous highlights with retained local color and surface detail
Lighting: follow the requested scene; use controlled bloom and reflected color without forcing pink, darkness, softness, or a particular light direction
Constraints: use references only for rendering language unless explicitly asked otherwise; preserve requested character, anatomy, palette, costume, pose, composition, setting, and lighting
Avoid: copying any reference character's hair, eyes, body shape, clothing, accessories, mechanical design, color scheme, prop, background, pose, crop, or camera angle; generic flat cel shading, uniformly heavy outlines, plastic skin, identical gloss on every material, uncontrolled bloom, clipped highlights, muddy eyes, text, watermark
```

## Reference Roles

- Style-only generation: use the one or two references closest to the requested lighting/material problem and exclude their content traits explicitly.
- Same-character generation: identify the relevant image as both identity and style reference; state which traits must remain.
- Style transfer: label the user's target as the edit/identity source and bundled images as style references; repeat that all content comes from the target.

Do not claim exact replication. Describe the result as an application of the shared visual language inferred from the reference set.
