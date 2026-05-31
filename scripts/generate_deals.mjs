import fs from 'fs';
import path from 'path';
import { fetchSearchContext } from './web_crawler.mjs';

const DEEPSEEK_API_KEY = "sk-a2dc0881aaac4bfcbe75b200177655b1";
const DEALS_DIR = path.join(process.cwd(), 'src', 'content', 'deals');

if (!fs.existsSync(DEALS_DIR)) fs.mkdirSync(DEALS_DIR, { recursive: true });

function sanitizeSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function callDeepSeek(prompt) {
  const reqBody = {
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7, // Higher temp for better marketing copy
    response_format: { type: "json_object" }
  };

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(reqBody)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function generateDeal(appName, category) {
  console.log(`\n======================================================`);
  console.log(`🤑 Pitching SaaS Deal: ${appName}`);
  
  // 1. Crawl for facts
  console.log(`🔍 Crawling ProductHunt and AppSumo mentions for ${appName}...`);
  let searchResults = "";
  try {
    searchResults = await fetchSearchContext(`"${appName}" lifetime deal SaaS features producthunt appsumo`);
  } catch (e) {
    console.warn(`⚠️ Crawl failed: ${e.message}`);
  }

  // 2. Ask DeepSeek to generate Schema + Markdown
  console.log(`🧠 Generating High-Conversion Pitch...`);
  const prompt = `
You are a top-tier SaaS Copywriter for YouBestDeal.com, a site that sells Lifetime Deals (like AppSumo).
Write a persuasive, FOMO-driven sales page for the SaaS product: "${appName}".

I have scraped the web for factual data. Here are the snippets:
---
${searchResults}
---

Your task is to output a single JSON object containing BOTH the frontmatter metadata and the full markdown pitch.
Write with urgency. Emphasize how much money the user saves by not paying monthly. Make it sound like an unmissable investment.

Output exactly this JSON structure (no markdown fences around it, just raw JSON):
{
  "title": "Exact Product Name",
  "description": "A 1-2 sentence hook highlighting the main value prop and the pain of monthly subscriptions.",
  "category": "${category}",
  "founder": "A realistic founder name",
  "originalPrice": "e.g., $990",
  "ltdPrice": "e.g., $49",
  "features": ["Feature 1 (e.g. Unlimited projects)", "Feature 2", "Feature 3", "Feature 4"],
  "isHot": true or false,
  "markdownContent": "The full persuasive sales pitch in Markdown. Include H2s like '## Stop Paying Monthly For X', '## Meet [Product]', '## Why You Need This Now'. Use bullet points, bold text for emphasis. Do not include the title (H1) or frontmatter."
}
`;

  const responseJson = await callDeepSeek(prompt);
  let parsed;
  try {
    parsed = JSON.parse(responseJson);
  } catch (e) {
    console.error("❌ Failed to parse output:", responseJson);
    return;
  }

  // 3. Write File
  const slug = sanitizeSlug(parsed.title);
  const filePath = path.join(DEALS_DIR, `${slug}.md`);
  const dateStr = new Date().toISOString().split('T')[0];

  const frontmatter = `---
title: "${parsed.title.replace(/"/g, '\\"')}"
description: "${parsed.description.replace(/"/g, '\\"')}"
category: "${parsed.category}"
founder: "${parsed.founder}"
originalPrice: "${parsed.originalPrice}"
ltdPrice: "${parsed.ltdPrice}"
features: ${JSON.stringify(parsed.features || [])}
isHot: ${parsed.isHot}
publishedAt: ${dateStr}
---

${parsed.markdownContent}
`;

  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  console.log(`   ✅ Created lifetime deal: ${slug}.md`);
}

async function run() {
  const deals = [
    { name: "WriteSonic AI", cat: "SEO" },
    { name: "Instantly.ai", cat: "CRM" },
    { name: "Metricool", cat: "Marketing" },
    { name: "BetterUptime", cat: "DevTools" },
    { name: "Veed.io", cat: "Marketing" }
  ];
  
  for (const d of deals) {
    await generateDeal(d.name, d.cat);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n🎉 Batch complete! Generated lifetime deals for ${deals.length} SaaS products.`);
}

run();
