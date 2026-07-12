# Mekhaneth approved visual language

This specification separates traits shared by all three references from traits belonging to a character, material, scene, or individual image.

## Invariant core

Prioritize these cross-reference traits:

1. Polished anime character rendering with simplified facial anatomy and carefully readable eyes.
2. Forms built mainly with smooth value and color transitions rather than dominant contour lines.
3. Selective edge hierarchy: crisp eyes, lashes, joints, and key material seams; softer secondary contours and distant detail.
4. Broad coherent highlights that describe volume while retaining local color.
5. Distinct material rendering: skin stays soft, hair silky, cloth subdued, and metal or synthetic armor more sharply reflective.
6. Controlled glow, bloom, and reflected color that support the scene without obscuring facial or surface detail.
7. Clear character silhouette and deliberate focal emphasis even when the pose, crop, and background vary.
8. Clean, attractive, high-finish presentation with limited incidental texture and little visual grime.

## Conditional traits

Use these only when supported by the requested subject or scene:

- Soft feathered edges and atmospheric haze for dim or intimate scenes.
- Crisper edges, harder cast shadows, stronger saturation, and lens sparkle for bright outdoor scenes.
- Pearly low-intensity skin highlights for diffuse light; firmer highlights for direct sun.
- Long flowing hair masses only for characters whose hairstyle requires them.
- Translucency for sheer cloth; subdued rolloff for ordinary fabric; tight bright reflections for polished synthetic or metal surfaces.
- Shallow depth of field for portrait emphasis; readable environmental geometry when the scene matters.

## Content leakage guards

Never infer the following from “style” alone:

- Palette: pink/magenta, monochrome black-and-white, cyan/blue, rainbow iridescence, or any other reference color.
- Character design: hair color, hairstyle, eye color, apparent age, body proportions, curves, android anatomy, horns or ear devices.
- Wardrobe/design: lace dress, blouse and pencil skirt, hosiery and heels, bodysuit, armor shells, joints, jewelry, ribbons, or floral ornaments.
- Scene/prop: bedroom, wood-paneled interior, poolside tiles, watermelon ice pop, furniture, or architecture.
- Composition: full-body standing portrait, centered symmetry, reclining diagonal pose, head tilt, hand pose, crop, or camera height.
- Lighting: pink rim light, warm lamplight, blue daylight, lens flare, dark ambience, or a fixed light direction.
- Mood: seductive, formal, reserved, summery, playful, futuristic, or intimate.
- Subject category: female character, single character, humanoid, adult-coded figure, or curvy anatomy.

## Per-reference evidence

### Kawaii Spice — `assets/base.jpg`

Supports soft bloom, feathered silhouettes, silky organic hair, pearly skin, dark smooth fabric, translucent lace, and dim atmospheric separation. Its pink palette, twin-tails, dress, body shape, room, pose, and framing are content.

### Purifier — `assets/purifier.png`

Supports smooth modeled anatomy, restrained line work, warm directional interior light, subdued cloth, satin-like skirt and hosiery, environmental depth, and controlled realism. Its white side ponytail, blue eyes, office-like outfit, proportions, wooden room, standing pose, and centered full-body crop are content.

### Mithleash — `assets/mithleash.png`

Supports crisp high-key anime rendering, saturated but controlled local color, sharp mechanical seams, glossy synthetic and metal differentiation, bright cast shadows, reflective color, and retained eye detail under strong light. Its mint hair, iridescent eyes, robotic body, cyan palette, pool, ice pop, reclining pose, lens flare, and diagonal crop are content.

## Avoidance criteria

Avoid uniformly thick outlines, flat unmodeled color steps, identical gloss across skin/hair/cloth/metal, waxy skin, metallic hair unless specified, uncontrolled haze, clipped white highlights, muddy eyes, random sparkle, noisy microtexture, clutter that weakens the silhouette, malformed hands or joints, text, signatures, and watermarks.

## Validation checklist

- Are the face and eyes readable at the intended size?
- Do volumes read through smooth, coherent gradients?
- Are sharp and soft edges assigned intentionally rather than globally?
- Do different materials respond differently to light?
- Does bloom preserve local color and detail?
- Did any palette, anatomy, outfit, prop, scene, pose, mood, or camera trait leak from a reference?
- Did the user's requested subject and scene remain authoritative?
