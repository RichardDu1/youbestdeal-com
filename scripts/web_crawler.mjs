// web_crawler.mjs
// This script scrapes DuckDuckGo HTML results to provide real-time grounding data to DeepSeek.

export async function fetchSearchContext(query) {
  console.log(`[Crawler] Searching for real data on: ${query}...`);
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Naive HTML parsing to extract snippet text without heavy dependencies like cheerio
    const snippets = [];
    const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = snippetRegex.exec(html)) !== null) {
      // Remove basic HTML tags from snippet
      const text = match[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
      if (text) snippets.push(text);
    }

    const context = snippets.slice(0, 5).join('\n\n');
    console.log(`[Crawler] Found ${snippets.length} real-time snippets.`);
    return context;

  } catch (error) {
    console.error('[Crawler] Failed to fetch search results:', error.message);
    return "";
  }
}
