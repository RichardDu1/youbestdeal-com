import fs from 'fs';
import path from 'path';
import { fetchSearchContext } from './web_crawler.mjs';

const DEEPSEEK_API_KEY = "sk-a2dc0881aaac4bfcbe75b200177655b1";
const DATA_FILE = path.join(process.cwd(), 'data', 'workflow_queue.json');
const WORKFLOWS_DIR = path.join(process.cwd(), 'src', 'content', 'workflows');
const TOOLS_DIR = path.join(process.cwd(), 'src', 'content', 'tools');

// Ensure directories exist
if (!fs.existsSync(WORKFLOWS_DIR)) fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
if (!fs.existsSync(TOOLS_DIR)) fs.mkdirSync(TOOLS_DIR, { recursive: true });

function sanitizeSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function callDeepSeek(prompt, isJSON = false) {
  const reqBody = {
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  };
  
  if (isJSON) reqBody.response_format = { type: "json_object" };

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

async function generateWorkflowAndTools(item) {
  console.log(`\n======================================================`);
  console.log(`🚀 Processing: ${item.topic}`);
  
  // 1. Gather Real Data via Search
  console.log(`🔍 Searching DuckDuckGo for real tools for: ${item.topic}`);
  let searchResults = "No results found.";
  try {
    searchResults = await fetchSearchContext(`best AI tools for ${item.topic}`);
  } catch (e) {
    console.warn(`⚠️ Search failed, proceeding with LLM knowledge: ${e.message}`);
  }

  // 2. Ask DeepSeek to generate Workflow + Tool Schema
  console.log(`🧠 Generating complete B2B Workflow and Tool specs...`);
  const generatorPrompt = `
You are a Software Deal Hunter writing for YouBestDeal.com. Focus on lifetime deals (LTDs), discounts, money-back guarantees, and ROI compared to monthly subscriptions.
Create an exhaustive B2B workflow guide for the topic: "${item.topic}".
Target Role: ${item.role}
Target Intent: ${item.intent}

I have performed a live web search for relevant tools. Here are the search results:
---
${searchResults}
---

Your task is to output a single JSON object containing BOTH the workflow markdown content AND the metadata for any specific tools/GPTs required by the workflow.
Use REAL tools that actually exist, preferably matching the search results.

Output exactly this JSON structure (no markdown fences around it, just raw JSON):
{
  "workflow": {
    "title": "Compelling Title",
    "description": "1-2 sentence compelling summary",
    "targetRole": ["${item.role}"],
    "targetIntent": ["${item.intent}"],
    "difficulty": "Beginner|Intermediate|Advanced",
    "setupTime": "e.g. 30 Minutes",
    "costEstimate": "e.g. $0 - $20/mo",
    "roi": "e.g. Saves 10 hours/week",
    "toolsUsedSlugs": ["tool-slug-1", "tool-slug-2"],
    "markdownContent": "The full step-by-step tutorial in Markdown format. Use H2s (##), bold text, and code blocks if necessary. Do not include frontmatter."
  },
  "tools": [
    {
      "slug": "tool-slug-1",
      "name": "Exact Tool Name",
      "description": "Short description of the tool",
      "category": "e.g. SEO, Content Creation, CRM",
      "isGPT": false,
      "pricing": "e.g. Free Tier, $20/mo",
      "affiliateUrl": "e.g. https://zapier.com",
      "tags": ["Automation", "Integration"],
      "markdownContent": "A short review/overview of the tool."
    }
  ]
}
`;

  const responseJson = await callDeepSeek(generatorPrompt, true);
  let parsed;
  try {
    parsed = JSON.parse(responseJson);
  } catch (e) {
    console.error("❌ Failed to parse DeepSeek output as JSON.", responseJson);
    return false;
  }

  const { workflow, tools } = parsed;

  // 3. Write Tool files (only if they don't exist to prevent overwriting)
  for (const tool of tools) {
    const toolPath = path.join(TOOLS_DIR, `${tool.slug}.md`);
    if (!fs.existsSync(toolPath)) {
      const toolFrontmatter = `---
name: "${tool.name.replace(/"/g, '\\"')}"
description: "${tool.description.replace(/"/g, '\\"')}"
category: "${tool.category}"
isGPT: ${tool.isGPT === true}
pricing: "${tool.pricing}"
affiliateUrl: "${tool.affiliateUrl}"
tags: ${JSON.stringify(tool.tags || [])}
---

${tool.markdownContent}
`;
      fs.writeFileSync(toolPath, toolFrontmatter, 'utf-8');
      console.log(`   🛠️ Created tool: ${tool.slug}`);
    } else {
      console.log(`   🛠️ Tool already exists: ${tool.slug}`);
    }
  }

  // 4. Write Workflow file
  const workflowSlug = sanitizeSlug(workflow.title);
  const workflowPath = path.join(WORKFLOWS_DIR, `${workflowSlug}.mdx`);
  const toolsUsedStr = JSON.stringify(workflow.toolsUsedSlugs || []);

  const workflowFrontmatter = `---
title: "${workflow.title.replace(/"/g, '\\"')}"
description: "${workflow.description.replace(/"/g, '\\"')}"
targetRole: ${JSON.stringify(workflow.targetRole || [])}
targetIntent: ${JSON.stringify(workflow.targetIntent || [])}
difficulty: "${workflow.difficulty}"
setupTime: "${workflow.setupTime}"
costEstimate: "${workflow.costEstimate}"
roi: "${workflow.roi}"
toolsUsed: ${toolsUsedStr}
---

${workflow.markdownContent}
`;

  fs.writeFileSync(workflowPath, workflowFrontmatter, 'utf-8');
  console.log(`   📄 Created workflow: ${workflowSlug}.mdx`);
  return true;
}

async function runMassGeneration(limit = 5) {
  if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ No workflow_queue.json found. Run generate_seed_topics.mjs first.");
    process.exit(1);
  }

  let queue = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let pendingItems = queue.filter(item => item.status === 'pending');

  if (pendingItems.length === 0) {
    console.log("✅ All items in the queue are completed!");
    return;
  }

  const itemsToProcess = pendingItems.slice(0, limit);
  console.log(`\n🚀 Starting mass generation batch of ${itemsToProcess.length} items...`);

  let successCount = 0;
  for (const item of itemsToProcess) {
    try {
      const success = await generateWorkflowAndTools(item);
      if (success) {
        item.status = 'completed';
        successCount++;
        // Save state after each success
        fs.writeFileSync(DATA_FILE, JSON.stringify(queue, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error(`❌ Fatal error processing ${item.topic}:`, e);
      item.status = 'failed';
      item.error = e.message;
      fs.writeFileSync(DATA_FILE, JSON.stringify(queue, null, 2), 'utf-8');
    }
    
    // Polite delay to avoid API rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n🎉 Batch complete! Successfully generated ${successCount} workflows.`);
}

// Run if called directly
const limit = process.argv.includes('--batch') ? 
  parseInt(process.argv[process.argv.indexOf('--batch') + 1]) : 5;

runMassGeneration(limit);
