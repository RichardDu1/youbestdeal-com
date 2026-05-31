import os
import json
import re
import urllib.request
from scrapling import Fetcher

# Define paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "tools_db.json")

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def get_awesome_list_urls():
    print("Fetching Awesome Generative AI list from GitHub...")
    url = "https://raw.githubusercontent.com/steven2358/awesome-generative-ai/main/README.md"
    try:
        req = urllib.request.urlopen(url)
        content = req.read().decode('utf-8')
    except Exception as e:
        print(f"Failed to fetch GitHub list: {e}")
        return []

    # Simple regex to find markdown links: [Name](http...) - Description
    # We will pick a subset (e.g., 15 items) to build our MVP DB fast.
    links = []
    pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
    for match in pattern.finditer(content):
        name = match.group(1).strip()
        link = match.group(2).strip()
        
        # Skip github repos for the MVP if we want high-end landing pages, 
        # but some high-end tools use github. Let's just collect valid URLs.
        if "github.com/steven2358" in link or "awesome.re" in link:
            continue
            
        links.append((name, link))
        if len(links) >= 15: # Limit for MVP testing
            break
            
    return links

def scrape_tools():
    ensure_dir(DATA_DIR)
    tools_to_scrape = get_awesome_list_urls()
    
    fetcher = Fetcher()
    tools_db = []
    
    print(f"Starting Data-First Pipeline: Scraping {len(tools_to_scrape)} tools...")
    
    for name, url in tools_to_scrape:
        print(f"Scraping [{name}] from {url} ...")
        try:
            # We configure scrapling dynamically
            page = fetcher.get(url)
            
            # Extract basic meta tags
            title_el = page.css("title")
            title = title_el[0].text.strip() if title_el else name
            
            desc_el = page.css("meta[name='description']")
            description = desc_el[0].attrib.get('content', '').strip() if desc_el else f"The best tool for {name}"
            
            # Try to grab some pricing hints or feature text
            body_text = "\n".join([p.text.strip() for p in page.css("p")[:2] if p.text.strip()])
            
            tool_data = {
                "id": name.lower().replace(" ", "-").replace("/", "-").replace("(", "").replace(")", ""),
                "name": name,
                "url": url,
                "meta_title": title,
                "description": description,
                "features_summary": body_text
            }
            tools_db.append(tool_data)
            print(f" -> Success: {name}")
        except Exception as e:
            print(f" -> Failed to scrape {name}: {e}")
            
    # Save to JSON
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(tools_db, f, indent=2, ensure_ascii=False)
        
    print(f"\nDatabase successfully built! Saved {len(tools_db)} tools to {DB_PATH}")

if __name__ == "__main__":
    scrape_tools()
