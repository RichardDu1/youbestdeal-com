import fs from 'fs';
import path from 'path';

const DEEPSEEK_API_KEY = "sk-a2dc0881aaac4bfcbe75b200177655b1";
const DATA_FILE = path.join(process.cwd(), 'data', 'workflow_queue.json');

const industries = ["AppSumo Lifetime Deals", "SEO Tools on Sale", "Design Software Coupons", "Marketing Automation LTDs", "Web Hosting Black Friday", "AI Writer Lifetime Deals"];

async function generateSeedTopicsBatch(batchSize = 20) {
  // Pick a random industry to focus this batch on
  const industry = industries[Math.floor(Math.random() * industries.length)];
  console.log(`🧠 Brainstorming ${batchSize} seed topics for industry: ${industry}...`);

  const prompt = `
You are a Software Deal Hunter for YouBestDeal.com. Focus on lifetime deals (LTDs), discounts, money-back guarantees, and ROI compared to monthly subscriptions.
Your task is to brainstorm exactly ${batchSize} highly specific, long-tail AI workflow ideas for the "${industry}" sector.
Each workflow should solve a real, painful business problem that can be automated using modern AI tools.

You MUST output a valid JSON OBJECT with a single key "workflows" containing an array of objects.
Do NOT output any markdown blocks, introductions, or conversational text.

Format requirements:
{
  "workflows": [
    {
      "topic": "String. The highly descriptive workflow title (e.g. 'Automating Patient Intake Forms with OCR and AI Summaries')",
      "role": "String. The target user role (e.g. 'dental-clinic-manager')",
      "intent": "String. The main goal (e.g. 'automate-intake')"
    }
  ]
}
  `.trim();

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  
  let parsed;
  try {
    parsed = JSON.parse(content);
    if (parsed.workflows) parsed = parsed.workflows;
    if (!Array.isArray(parsed)) {
      for (const key in parsed) {
        if (Array.isArray(parsed[key])) {
          parsed = parsed[key];
          break;
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse JSON response:", content.substring(0, 200) + '...');
    // Attempt a dirty regex extraction if JSON parsing fails due to truncation
    console.log("⚠️ Attempting emergency regex recovery for truncated JSON...");
    const matches = [...content.matchAll(/{\s*"topic":\s*"[^"]+",\s*"role":\s*"[^"]+",\s*"intent":\s*"[^"]+"\s*}/g)];
    if (matches.length > 0) {
      try {
        parsed = matches.map(m => JSON.parse(m[0]));
        console.log(`🔧 Recovered ${parsed.length} workflows from truncated output.`);
        return parsed;
      } catch (err) {
        throw new Error("JSON Parse Error due to severe truncation.");
      }
    }
    throw new Error("JSON Parse Error due to truncation.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("API did not return a JSON array of workflows.");
  }
  return parsed;
}

async function runGenerator(totalLimit) {
  let existingQueue = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      existingQueue = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch(e) {}
  }

  const maxBatch = 20;
  let remaining = totalLimit;

  while (remaining > 0) {
    const currentBatch = Math.min(maxBatch, remaining);
    try {
      const parsed = await generateSeedTopicsBatch(currentBatch);
      const newItems = parsed.map(item => ({ ...item, status: 'pending' }));
      existingQueue.push(...newItems);
      fs.writeFileSync(DATA_FILE, JSON.stringify(existingQueue, null, 2), 'utf-8');
      
      console.log(`✅ Added ${newItems.length} workflows. Total in queue: ${existingQueue.length}`);
      remaining -= currentBatch;
      
      if (remaining > 0) {
        console.log(`⏳ Waiting 3s before next batch. Remaining: ${remaining}`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (error) {
      console.error("❌ Batch failed:", error.message);
      // Wait longer on fail
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

const limit = process.argv.includes('--limit') ? 
  parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : 50;
  
runGenerator(limit);
