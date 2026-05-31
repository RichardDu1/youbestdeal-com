import fs from 'fs/promises';
import path from 'path';

// CONFIGURATION
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'YOUR_DEEPSEEK_API_KEY_HERE';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md'; // Example awesome list
const OUTPUT_DIR = path.join(process.cwd(), 'src/content/workflows');

// Ensure output directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// 1. Fetch Data from GitHub Awesome List
async function fetchAwesomeList() {
  console.log(`[1] Fetching Awesome AI Agents list from GitHub...`);
  try {
    const response = await fetch(GITHUB_RAW_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    return text;
  } catch (error) {
    console.error('Failed to fetch awesome list:', error);
    return null;
  }
}

// 2. Parse Markdown for Tool Names and Descriptions
function parseTools(markdown) {
  console.log(`[2] Parsing tools from markdown...`);
  const tools = [];
  const lines = markdown.split('\n');
  
  // Basic regex to match list items with links: - [Tool Name](url) - Description
  const regex = /^\s*-\s*\[(.*?)\]\((.*?)\)(?:\s*[-:]\s*(.*))?$/;
  
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      tools.push({
        name: match[1].trim(),
        url: match[2].trim(),
        description: match[3] ? match[3].trim() : ''
      });
    }
  }
  
  console.log(`Found ${tools.length} potential tools.`);
  return tools;
}

// 3. Call DeepSeek API to generate workflow content
async function generateWorkflowWithDeepSeek(tool) {
  console.log(`[3] Generating workflow for ${tool.name} via DeepSeek API...`);
  
  if (DEEPSEEK_API_KEY === 'YOUR_DEEPSEEK_API_KEY_HERE') {
    console.warn(`⚠️ Warning: DeepSeek API key not configured. Mocking response for ${tool.name}.`);
    return mockGenerate(tool);
  }

  const prompt = `
  You are an expert B2B tech analyst. 
  Tool: ${tool.name}
  Description: ${tool.description}
  URL: ${tool.url}
  
  Write a high-end, professional SEO-optimized workflow article about how to use this AI tool.
  Format as MDX frontmatter + markdown body.
  
  Requirements:
  - Title: Action-oriented workflow (e.g. "Automate Lead Generation with [Tool]")
  - Category: One of: Agents, Automation, Data, Development
  - Body: Include "The Challenge", "The Solution", and "Step-by-Step Workflow".
  - Tone: Professional, B2B, premium.
  
  Output ONLY valid MDX.
  `;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }
    throw new Error('Invalid response from DeepSeek');
  } catch (error) {
    console.error(`DeepSeek API failed for ${tool.name}:`, error);
    return null;
  }
}

// Fallback for when API key is not set
function mockGenerate(tool) {
  const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `---
title: "Automate Enterprise Tasks with ${tool.name}"
description: "Discover the high-end workflow using ${tool.name} to scale your B2B operations."
pubDate: "${new Date().toISOString()}"
category: "Agents"
author: "AI Systems Engineer"
image: "/images/workflows/default-agent.webp"
taskTitle: "Streamline Operations with ${tool.name}"
userIntent: "Automate manual tasks and increase team productivity"
---

# Transform Your Business with ${tool.name}

${tool.description}

## The Challenge
In modern enterprise environments, scaling manual operations leads to bottlenecks. Companies need robust, autonomous agents to handle complex workflows without constant human oversight.

## The Solution
Enter **${tool.name}**. It provides a programmable framework to automate decisions and execute multi-step tasks across your infrastructure.

## Step-by-Step Workflow
1. **Integration**: Connect your existing SaaS tools to the agent framework.
2. **Configuration**: Define the exact parameters and boundaries for autonomous action.
3. **Execution**: Allow the agent to process data and trigger actions.
4. **Review**: Monitor the human-in-the-loop dashboard for edge cases.

[Learn more about ${tool.name}](${tool.url})
`;
}

// 4. Main Execution
async function main() {
  await ensureDir(OUTPUT_DIR);
  
  const markdown = await fetchAwesomeList();
  if (!markdown) return;
  
  const tools = parseTools(markdown);
  // Only process the first 5 for now to avoid massive API costs / rate limits
  const targetTools = tools.slice(0, 5);
  
  for (const tool of targetTools) {
    const mdxContent = await generateWorkflowWithDeepSeek(tool);
    if (mdxContent) {
      const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filePath = path.join(OUTPUT_DIR, `${slug}.md`);
      
      // Remove markdown codeblock backticks if DeepSeek added them
      const cleanContent = mdxContent.replace(/^```mdx?\\n/, '').replace(/\\n```$/, '');
      
      await fs.writeFile(filePath, cleanContent, 'utf-8');
      console.log(`✅ Saved workflow for ${tool.name} -> ${filePath}`);
    }
    // Sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('🎉 Scraping and generation complete!');
}

main().catch(console.error);
