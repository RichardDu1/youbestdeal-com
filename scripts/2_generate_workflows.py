import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

# Initialize DeepSeek Client
# DeepSeek is compatible with the OpenAI Python SDK
api_key = os.getenv("DEEPSEEK_API_KEY")
if not api_key:
    print("Error: DEEPSEEK_API_KEY not found in environment or .env file.")
    print("Please add your DeepSeek API Key to the .env file.")
    exit(1)

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com/v1"  # DeepSeek's base URL
)

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(BASE_DIR, "data", "tools_db.json")
WORKFLOW_DIR = os.path.join(BASE_DIR, "src", "content", "workflows", "en")

# Seed Scenarios to generate workflows for MVP
SCENARIOS = [
    {
        "title": "Automate Content Generation",
        "intent": "I want to automatically write SEO optimized blog posts",
        "difficulty": "Intermediate"
    },
    {
        "title": "Create Faceless Videos",
        "intent": "How to generate viral faceless videos for TikTok and YouTube Shorts",
        "difficulty": "Advanced"
    }
]

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def generate_workflows():
    ensure_dir(WORKFLOW_DIR)
    
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}. Please run 1_build_tool_db.py first.")
        return

    with open(DB_PATH, "r", encoding="utf-8") as f:
        tools_db = json.load(f)
        
    print(f"Loaded {len(tools_db)} tools from database.")
    
    # We pass the tools database to DeepSeek so it knows what tools exist in our platform
    tools_context = json.dumps(tools_db, ensure_ascii=False)
    
    for scenario in SCENARIOS:
        print(f"Generating workflow: {scenario['title']}...")
        
        prompt = f"""
You are an expert AI Workflow Architect for the platform "FindTheAIForThat".
Your goal is to provide a step-by-step workflow solution using ONLY the AI tools provided in our database context.

Available Tools Database (JSON):
{tools_context}

User Task Intent: {scenario['intent']}
Task Title: {scenario['title']}
Difficulty: {scenario['difficulty']}

Please output a standard Markdown document for this workflow. 
The Markdown MUST include the frontmatter block at the top EXACTLY like this:

---
taskTitle: "{scenario['title']}"
userIntent: "{scenario['intent']}"
difficulty: "{scenario['difficulty']}"
toolsUsed: ["tool-id-1", "tool-id-2"] # Use the exact 'id' from the Tools Database
pubDate: 2026-05-31
---

# How to: {scenario['title']}

## Overview
(Write a brief overview of why this workflow is useful and what it achieves)

## Step-by-Step Workflow
(Write 2-4 steps. For each step, mention the tool from the database used and what it does. e.g. "Step 1: Use [Tool Name](url) to do X...")

## Pro Tips
(Give 1 or 2 tips for success)
"""

        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "You are a professional workflow architect."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500,
                temperature=0.7
            )
            
            md_content = response.choices[0].message.content.strip()
            
            # Parse out any markdown formatting artifacts if DeepSeek wraps it in ```markdown
            if md_content.startswith("```markdown"):
                md_content = md_content.split("\n", 1)[1]
                if md_content.endswith("```"):
                    md_content = md_content.rsplit("\n", 1)[0]
                    
            slug = scenario['title'].lower().replace(" ", "-")
            filepath = os.path.join(WORKFLOW_DIR, f"{slug}.md")
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(md_content)
                
            print(f" -> Successfully generated {filepath}")
            
        except Exception as e:
            print(f" -> Failed to generate {scenario['title']}: {e}")

if __name__ == "__main__":
    generate_workflows()
