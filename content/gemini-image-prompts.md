# AROS — Gemini Image Generation Prompts

Use these prompts with [Gemini Image Generation](https://gemini.google/overview/image-generation/) to create visual assets for the AROS landing page and social media.

**Brand palette:** Navy `#0F172A`, Blue `#3B82F6`, Emerald `#10B981`, White `#FFFFFF`
**Style:** Modern, minimal, dark tech aesthetic with blue/emerald accents. No text in images.

---

## 1. Hero Illustration

### Prompt
```
A futuristic retail store interior seen from a wide cinematic angle. The store has clean glass shelving with products, and floating holographic AI dashboard panels in the air showing bar charts, inventory counts, and sales metrics. The panels glow with soft blue (#3B82F6) and emerald green (#10B981) light. Subtle particle effects and data streams connect the panels. Dark navy background with ambient lighting. Modern, sleek, minimal 3D render style. No people, no text. 16:9 aspect ratio. Ultra high quality.
```

### Variation (Abstract)
```
An abstract 3D composition showing a dark navy sphere at center surrounded by orbiting translucent data panels, glowing connection lines, and small floating geometric shapes. Blue (#3B82F6) and emerald (#10B981) accent lighting. Clean dark background with subtle grid lines. Represents an AI operating system. Futuristic minimal tech aesthetic. No text. 16:9 aspect ratio.
```

---

## 2. Feature Illustrations (6 images, square 1:1)

### 2a. POS Integration
```
A sleek modern point-of-sale terminal with a holographic connection beam linking it to a floating dashboard in the air. Blue glow (#3B82F6) on the connection beam. Dark minimal background. Clean 3D render, isometric view. No text, no people. Square format 1:1.
```

### 2b. AI Analytics
```
A floating 3D bar chart with translucent glass-like bars in blue and emerald colors. Small glowing data particles rise from the bars. Dark navy background. Clean isometric 3D render style. No text. Square 1:1.
```

### 2c. Agent Workforce
```
A circular arrangement of 6 small glowing orbs (AI agents) connected by thin luminous lines to a central larger orb. Each small orb has a different subtle icon glow — chart, shield, gear, magnifying glass, chat bubble, shopping cart. Blue and emerald accent colors on dark navy background. Minimal futuristic 3D render. No text. Square 1:1.
```

### 2d. Fleet Management
```
A bird's eye view of a minimal city grid with 5 small store buildings. Each store has a soft glowing dome above it. Thin light beams connect all stores to a central floating hub. Blue and emerald glow. Dark background with subtle grid. Clean 3D render. No text. Square 1:1.
```

### 2e. Marketplace
```
A floating storefront window displaying rows of small glowing app icons arranged in a grid. The storefront has a clean modern frame. Soft blue and emerald backlighting. Dark navy background. Minimal futuristic 3D render. No text, no real app logos. Square 1:1.
```

### 2f. Self-Hosted / Privacy
```
A glowing server rack enclosed in a translucent protective shield dome. Small lock icon floating above. Blue and emerald accent lighting on the server LEDs. Dark background with subtle grid pattern. Clean minimal 3D render. No text. Square 1:1.
```

---

## 3. Social Media Assets

### 3a. Instagram Post — Product Announcement (1:1, 1080x1080)
```
A dark navy background with a floating 3D glass card in the center. The card has a subtle blue-to-emerald gradient border glow. Inside the card, a minimal AI dashboard with bar charts and metric numbers. Soft ambient particles around the card. Modern tech product announcement style. No text. Square 1:1. Ultra sharp.
```

### 3b. Instagram Story — Feature Highlight (9:16, 1080x1920)
```
A vertical composition with a dark navy background. A large glowing emerald checkmark at top. Below it, three floating glass cards stacked vertically with subtle offset, each showing a different minimal data visualization (line chart, pie chart, bar chart). Blue and emerald accent glow. Floating particles. No text. 9:16 vertical format.
```

### 3c. Twitter/X Header — Brand Banner (3:1, 1500x500)
```
A wide panoramic dark navy background with a subtle grid pattern. In the center, a minimal glowing AROS logo-style mark — a rounded square with a mountain/chart line in emerald green and a blue accent dot. Soft radial glow behind the mark. Clean, premium, ultra-minimal. No text. 3:1 wide aspect ratio.
```

### 3d. LinkedIn Post — Company Update (1.91:1, 1200x627)
```
A wide shot of an abstract futuristic retail command center. Multiple floating holographic panels showing sales data, inventory levels, and AI agent status indicators. Blue and emerald glowing accents on dark navy background. Professional, corporate tech aesthetic. No text. 1.91:1 aspect ratio.
```

### 3e. LinkedIn Banner — Company Page (4:1, 1584x396)
```
An ultra-wide dark navy gradient background with very subtle geometric grid lines. A thin horizontal line of connected glowing nodes spans the width — each node is a small blue or emerald circle representing an AI agent. Minimal, clean, premium tech feel. No text. 4:1 ultra-wide.
```

### 3f. Open Graph / Link Preview (1.91:1, 1200x630)
```
Dark navy background with centered floating 3D isometric retail store building. The store has a translucent roof showing AI dashboard holograms inside. Soft blue and emerald glow emanating from within. Clean tech illustration style. No text. 1.91:1 aspect ratio.
```

---

## 4. Animated Background Textures (for CSS/video)

### 4a. Gradient Mesh
```
An abstract gradient mesh background. Dark navy (#0F172A) base with smooth flowing gradients of deep blue (#1E3A5F) and emerald (#0D4A3B) blending organically. Looks like aurora borealis in dark water. Very subtle, no bright spots. No text, no objects. 16:9.
```

### 4b. Particle Field
```
A dark navy background with hundreds of tiny luminous dots scattered randomly. Some dots glow blue, some emerald. Very subtle thin lines connect nearby dots like a constellation map. Minimal, elegant, tech wallpaper. No text. 16:9.
```

---

## Usage Guide

1. Go to [Gemini](https://gemini.google/overview/image-generation/)
2. Paste each prompt and generate
3. Download the best result for each
4. Save to `aros-platform/apps/web/public/images/` with these names:
   - `hero-illustration.png` (or .webp)
   - `feature-pos.png`
   - `feature-analytics.png`
   - `feature-agents.png`
   - `feature-fleet.png`
   - `feature-marketplace.png`
   - `feature-selfhosted.png`
   - `social-ig-post.png`
   - `social-ig-story.png`
   - `social-twitter-header.png`
   - `social-linkedin-post.png`
   - `social-linkedin-banner.png`
   - `social-og-image.png`
   - `bg-gradient-mesh.png`
   - `bg-particle-field.png`

5. After downloading, update the landing page to reference the images (hero section, feature cards).

## Tips for Best Results

- If Gemini adds text to the image, re-run with "Absolutely no text, words, letters, or numbers in the image"
- For consistent style across all images, add "Same style as previous" or re-paste the style description
- Generate 2-3 variations and pick the best
- Export at highest resolution available, then compress with `cwebp` or `sharp` before deploying
