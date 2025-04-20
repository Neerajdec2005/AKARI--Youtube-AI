import { supabase } from '../../lib/supabase';
import { getEmbedding } from '../../lib/embeddings';
import { fetchTrendingVideos, fetchTrendingShorts } from '../../lib/youtube';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!GEMINI_API_KEY || !YOUTUBE_API_KEY) {
  throw new Error('Please set both GEMINI_API_KEY and YOUTUBE_API_KEY in your .env file.');
}

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function searchYouTube(query, maxResults = 5) {
  const response = await axios.get(YOUTUBE_API_URL, {
    params: {
      key: YOUTUBE_API_KEY,
      q: query,
      part: 'snippet',
      type: 'video',
      maxResults
    }
  });

  return response.data.items.map(item => {
    const { title, description } = item.snippet;
    return { title, description };
  });
}

function cleanGeminiText(text) {
  return text
    .replace(/[*#]/g, '') 
    .split('\n')
    .map(line => line.trimEnd()) 
    .filter((line, idx, arr) => {
      return line || (arr[idx + 1] && arr[idx + 1].trim());
    })
    .join('\n')
    .trim();
}


async function getGeminiResponse(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const rawText = result.response.text();
  return cleanGeminiText(rawText);
}

async function getGeminiResponseStream(prompt, onWord) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  for await (const chunk of result.stream) {
    const raw = chunk.text();
    if (raw) {
      const cleaned = cleanGeminiText(raw);
      if (cleaned) onWord(cleaned);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { userId, conversationId, query, contextAction } = req.body;

  try {
    const { data: memories, error: memError } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (memError) throw memError;

    const embedding = await getEmbedding(query);

    const pastContext = memories.length
      ? memories.map(m => `User: ${m.query}\nAgent: ${m.response}`).join('\n')
      : 'No previous context available.';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();

    let fullResponse = '';
    const onWord = word => {
      fullResponse += word;
      res.write(word);
    };

    if (contextAction === 'trending') {
      const videos = await fetchTrendingVideos(query);
      const shorts = await fetchTrendingShorts(query);
    
      const allTitles = [...videos, ...shorts].map(v => v.title);
    
      const wordFreq = {};
      allTitles.forEach(title => {
        const words = title.toLowerCase().match(/\w+/g);
        if (words) {
          words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          });
        }
      });
    
      const stopWords = new Set([
        'the', 'a', 'an', 'in', 'on', 'of', 'and', 'to', 'is', 'for', 
        'with', 'this', 'that', 'by', 'from'
      ]);
    
      const trendingTopics = Object.entries(wordFreq)
        .filter(([word]) => !stopWords.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word], idx) => `${idx + 1}. ${word.charAt(0).toUpperCase() + word.slice(1)}`);
    
      const trendingVideos = videos.map((v, i) => `${i + 1}. ${v.title}`);
      const trendingShorts = shorts.map((s, i) => `${i + 1}. ${s.title}`);
    
      const trendingResponse = {
        trendingTopics,
        trendingVideos,
        trendingShorts
      };
    
      res.end(JSON.stringify(trendingResponse, null, 2));
      return;
    }
    

    let prompt;
    if (contextAction === 'script') {
      prompt = `Generate a YouTube script structure for the topic "${query}" including:\n- Introduction (0:00 - 0:45): Hook the viewer.\n- Section 1 (0:45 - 3:00): Topic Overview.\n- Section 2 (3:00 - 7:00): Detailed Explanation.\n- Section 3 (7:00 - 10:00): Case Studies/Examples.\n- Call to Action (10:00 - 10:30): Invite the viewer to engage.`;
      await getGeminiResponseStream(prompt, onWord);
    } else if (contextAction === 'research') {
      prompt = `Generate a structured research overview for the topic "${query}" including:\n- A concise topic overview.\n- Uniqueness analysis.\n- A list of suggested ideas.\n- Implementation methods with examples.`;
      await getGeminiResponseStream(prompt, onWord);
    } else if (contextAction === 'research-paper') {
      prompt = `Create a detailed research paper outline for the topic "${query}". The structure should include:\n\n- Abstract\n- Introduction\n- Literature Review\n- Proposed Methodology\n- Results and Discussion\n- Conclusion and Future Work\n- References\n\nEach section should have 3-4 bullet points summarizing the content it should contain.`;
      await getGeminiResponseStream(prompt, onWord);
    } else if (contextAction === 'video-idea') {
      const results = await searchYouTube(query);
      const combinedPrompt = `Based on the following YouTube search results:\n\n${'-'.repeat(40)}\n${results.map(r => `Title: ${r.title}\nDescription: ${r.description}`).join('\n\n')}\n${'-'.repeat(40)}\n\nGenerate a creative, unique, and detailed video content idea for the query: "${query}".`;
      const idea = await getGeminiResponse(combinedPrompt);
      res.end(JSON.stringify({ idea }));
      return;
    } else {
      prompt = `User asked: "${query}"\n\nConversation history:\n${pastContext}\n\nPlease provide a thoughtful and detailed response.`;
      await getGeminiResponseStream(prompt, onWord);
    }

    await supabase.from('memories').insert([{ user_id: userId, conversation_id: conversationId, query, response: fullResponse, embedding }]);
    res.end();
  } catch (error) {
    console.error('Chat API error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.end();
    }
  }
}
