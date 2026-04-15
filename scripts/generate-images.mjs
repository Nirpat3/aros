#!/usr/bin/env node

/**
 * AROS Image Generator — Uses Gemini API (Nano Banana 2) to generate
 * all visual assets for the landing page and social media.
 *
 * Prerequisites:
 *   1. Get a free API key at https://aistudio.google.com/apikey
 *   2. Set it: export GOOGLE_API_KEY="your-key-here"
 *   3. Run:    node scripts/generate-images.mjs
 *
 * Or pass it inline: GOOGLE_API_KEY=your-key node scripts/generate-images.mjs
 *
 * Uses @google/genai SDK with gemini-3.1-flash-image-preview (Nano Banana 2)
 */

import { GoogleGenAI } from '@google/genai';
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'apps', 'web', 'public', 'images');
mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('\n  Missing API key. Get one free at https://aistudio.google.com/apikey');
  console.error('  Then run: export GOOGLE_API_KEY="your-key-here"\n');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL = 'gemini-3.1-flash-image-preview'; // Nano Banana 2

/* ─── billing tracker ─── */
const BILLING_DIR = join(homedir(), '.shre', 'billing');
mkdirSync(BILLING_DIR, { recursive: true });
const billingLog = join(BILLING_DIR, 'gemini-image-usage.jsonl');

function trackUsage(imageName, success, sizeBytes = 0) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'aros-image-gen',
    model: MODEL,
    image: imageName,
    success,
    sizeBytes,
    apiKey: API_KEY.slice(0, 8) + '...' + API_KEY.slice(-4),
  };
  appendFileSync(billingLog, JSON.stringify(entry) + '\n');
}

/* ─── brand style prefix ─── */
const STYLE = `Modern, minimal, dark tech aesthetic. Brand colors: navy #0F172A, blue #3B82F6, emerald green #10B981. Clean 3D render style. Ultra high quality. Absolutely no text, words, letters, or numbers in the image.`;

/* ─── all image prompts ─── */
const prompts = [
  // Hero
  {
    name: 'hero-illustration',
    prompt: `A futuristic retail store interior seen from a wide cinematic angle. The store has clean glass shelving with products, and floating holographic AI dashboard panels in the air showing bar charts, inventory counts, and sales metrics. The panels glow with soft blue (#3B82F6) and emerald green (#10B981) light. Subtle particle effects and data streams connect the panels. Dark navy background (#0F172A) with ambient lighting. 16:9 aspect ratio. ${STYLE}`,
  },

  // Feature illustrations
  {
    name: 'feature-pos',
    prompt: `A sleek modern point-of-sale terminal with a holographic connection beam linking it to a floating dashboard in the air. Blue glow (#3B82F6) on the connection beam. Dark minimal background. Isometric view. Square format 1:1. ${STYLE}`,
  },
  {
    name: 'feature-analytics',
    prompt: `A floating 3D bar chart with translucent glass-like bars in blue and emerald colors. Small glowing data particles rise from the bars. Dark navy background. Isometric view. Square 1:1. ${STYLE}`,
  },
  {
    name: 'feature-agents',
    prompt: `A circular arrangement of 6 small glowing orbs (AI agents) connected by thin luminous lines to a central larger orb. Each small orb has a different subtle icon glow — chart, shield, gear, magnifying glass, chat bubble, shopping cart. Blue and emerald accent colors on dark navy background. Square 1:1. ${STYLE}`,
  },
  {
    name: 'feature-fleet',
    prompt: `A bird's eye view of a minimal city grid with 5 small store buildings. Each store has a soft glowing dome above it. Thin light beams connect all stores to a central floating hub. Blue and emerald glow. Dark background with subtle grid. Square 1:1. ${STYLE}`,
  },
  {
    name: 'feature-marketplace',
    prompt: `A floating storefront window displaying rows of small glowing app icons arranged in a grid. The storefront has a clean modern frame. Soft blue and emerald backlighting. Dark navy background. Square 1:1. ${STYLE}`,
  },
  {
    name: 'feature-selfhosted',
    prompt: `A glowing server rack enclosed in a translucent protective shield dome. Small lock icon floating above. Blue and emerald accent lighting on the server LEDs. Dark background with subtle grid pattern. Square 1:1. ${STYLE}`,
  },

  // Social media
  {
    name: 'social-ig-post',
    prompt: `A dark navy background with a floating 3D glass card in the center. The card has a subtle blue-to-emerald gradient border glow. Inside the card, a minimal AI dashboard with bar charts and metric numbers. Soft ambient particles around the card. Modern tech product announcement style. Square 1:1 1080x1080 feel. ${STYLE}`,
  },
  {
    name: 'social-linkedin-post',
    prompt: `A wide shot of an abstract futuristic retail command center. Multiple floating holographic panels showing sales data, inventory levels, and AI agent status indicators. Blue and emerald glowing accents on dark navy background. Professional, corporate tech aesthetic. 1.91:1 wide aspect ratio. ${STYLE}`,
  },
  {
    name: 'social-og-image',
    prompt: `Dark navy background with centered floating 3D isometric retail store building. The store has a translucent roof showing AI dashboard holograms inside. Soft blue and emerald glow emanating from within. Clean tech illustration style. 1.91:1 aspect ratio. ${STYLE}`,
  },

  // Background textures
  {
    name: 'bg-gradient-mesh',
    prompt: `An abstract gradient mesh background. Dark navy (#0F172A) base with smooth flowing gradients of deep blue (#1E3A5F) and emerald (#0D4A3B) blending organically. Looks like aurora borealis in dark water. Very subtle, no bright spots. No objects. 16:9. ${STYLE}`,
  },
];

/* ─── generate ─── */
async function generateImage(item) {
  const tag = `[${item.name}]`;
  console.log(`${tag} Generating...`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: item.prompt,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    let saved = false;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const ext = part.inlineData.mimeType?.includes('png') ? 'png' : 'png';
        const outPath = join(OUT_DIR, `${item.name}.${ext}`);
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        writeFileSync(outPath, buffer);
        console.log(`${tag} Saved → ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
        trackUsage(item.name, true, buffer.length);
        saved = true;
        break;
      }
    }

    if (!saved) {
      // Check if there's text explaining why it couldn't generate
      const textParts = response.candidates[0].content.parts.filter(p => p.text);
      if (textParts.length) {
        console.warn(`${tag} No image returned. Model said: ${textParts.map(p => p.text).join(' ')}`);
      } else {
        console.warn(`${tag} No image data in response`);
      }
    }

    return saved;
  } catch (err) {
    console.error(`${tag} Error: ${err.message}`);
    trackUsage(item.name, false, 0);
    return false;
  }
}

async function main() {
  console.log(`\n  AROS Image Generator`);
  console.log(`  Model: ${MODEL} (Nano Banana 2)`);
  console.log(`  Output: ${OUT_DIR}`);
  console.log(`  Images: ${prompts.length}\n`);

  let success = 0;
  let failed = 0;

  // Generate sequentially to avoid rate limits
  for (const item of prompts) {
    const ok = await generateImage(item);
    if (ok) success++;
    else failed++;

    // Brief pause between requests to avoid rate limiting
    if (prompts.indexOf(item) < prompts.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n  Done: ${success} generated, ${failed} failed`);
  console.log(`  Images saved to: ${OUT_DIR}`);
  console.log(`  Billing log: ${billingLog}\n`);

  if (success > 0) {
    console.log('  Next steps:');
    console.log('  1. Review images in apps/web/public/images/');
    console.log('  2. Re-run any failed ones individually');
    console.log('  3. Rebuild: pnpm --filter @aros/web build');
    console.log('  4. Restart shre-site: launchctl kickstart -k gui/$(id -u)/ai.shre.shre-site\n');
  }
}

main();
