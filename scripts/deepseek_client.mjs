// deepseek_client.mjs
export const DEEPSEEK_API_KEY = 'sk-a2dc0881aaac4bfcbe75b200177655b1';
export const API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function callDeepSeek(prompt, systemPrompt = 'You are an expert content strategist and B2B tech analyst.') {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      } else {
        throw new Error('Invalid response format from DeepSeek API');
      }
    } catch (error) {
      console.warn(`[DeepSeek API Attempt ${attempt} Failed]:`, error.message);
      if (attempt === maxRetries) {
        console.error('Max retries reached. Returning null.');
        return null;
      }
      // Exponential backoff
      await new Promise(res => setTimeout(res, attempt * 2000));
    }
  }
}
