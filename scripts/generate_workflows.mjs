// generate_workflows.mjs
import fs from 'fs/promises';
import path from 'path';
import { callDeepSeek } from './deepseek_client.mjs';

const OUTPUT_DIR = path.join(process.cwd(), 'src/content/workflows');

// Roles and Intents for the Finder UI
const TARGET_WORKFLOWS = [
  { role: 'Real Estate Agent', intent: 'Content Generation', task: 'Automate property listings from voice memos' },
  { role: 'Sales SDR', intent: 'Lead Generation', task: 'Scrape LinkedIn for leads and draft personalized cold emails' },
  { role: 'Developer', intent: 'Automation', task: 'Automate code review and generate PR descriptions' },
  { role: 'Marketer', intent: 'SEO Optimization', task: 'Analyze competitor SEO strategies and generate content briefs' },
  { role: 'E-commerce Owner', intent: 'Customer Support', task: 'Automatically reply to customer support emails' }
];

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function generateWorkflow(item) {
  const prompt = `
You are an expert AI automation architect. Create a highly actionable, structured workflow article for a [${item.role}] whose intent is [${item.intent}] specifically aiming to "${item.task}".

Output ONLY valid MDX format with YAML frontmatter and markdown body. Do not include any surrounding markdown code blocks (like \`\`\`mdx).

REQUIREMENTS:
1. FRONTMATTER (Must exactly match this schema, output as YAML):
---
title: "How to ${item.task}"
description: "A complete AI workflow for ${item.role}s to automate this task using top AI tools."
targetRole: ["${item.role}"]
userIntent: ["${item.intent}"]
toolsUsed: ["chatgpt", "make-com"]
difficulty: "Intermediate"
setupTime: "30 mins"
costEstimate: "$20/mo"
roi: "Saves 10 hours a week"
pubDate: 2026-05-31
locale: "en"
---

2. BODY CONTENT:
- Start with an H1 heading (same as title)
- "The Challenge" (Why doing this manually sucks)
- "The Stack" (Briefly introduce the tools used)
- "Step-by-Step Guide" (Numbered list with specific, actionable instructions)
- "The Prompt Box" (Provide a highly engineered, copy-pasteable prompt in a blockquote or codeblock)

Make the tone professional, objective, and authoritative (like a high-end tech consultant).
`;

  console.log(`Generating workflow for: ${item.role} - ${item.task}...`);
  let content = await callDeepSeek(prompt);
  if (!content) return;

  // Clean up potential markdown code block wrappers
  content = content.replace(/^```(mdx?|markdown|yaml)?\n/i, '').replace(/\n```$/i, '');

  const slug = `${item.role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${item.intent.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/(^-|-$)/g, '');
  const filePath = path.join(OUTPUT_DIR, `${slug}.md`);

  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`✅ Saved: ${slug}.md`);
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  console.log(`Starting GEO workflow generation for ${TARGET_WORKFLOWS.length} tasks...`);
  
  for (const item of TARGET_WORKFLOWS) {
    await generateWorkflow(item);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('🎉 Workflow generation complete!');
}

main().catch(console.error);
