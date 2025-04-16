import { supabase } from '../../lib/supabase';
import { getEmbedding } from '../../lib/embeddings';
import { fetchTrendingVideos, fetchTrendingShorts } from '../../lib/youtube';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!GEMINI_API_KEY || !YOUTUBE_API_KEY) {
  throw new Error('Please set both GEMINI_API_KEY and YOUTUBE_API_KEY in your .env file.');
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

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
    return `Title: ${title}\nDescription: ${description}`;
  });
}

async function getGeminiResponseFromSearch(query) {
  const searchResults = await searchYouTube(query);
  const prompt = `Based on the following YouTube search results:\n\n${'-'.repeat(40)}\n${searchResults.join('\n\n')}\n${'-'.repeat(40)}\n\nGenerate a creative, unique, and detailed video content idea for the query: \"${query}\".`;
  return getGeminiResponse(prompt);
}

function cleanGeminiText(text) {
    return text
      .split('\n') // preserve line breaks
      .map(line => line.replace(/[*#]/g, '').trim()) // remove *, # from each line
      .join('\n') // join lines back with newlines
      .trim();
  }
  

async function getGeminiResponse(prompt) {
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const data = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(url, data, { headers });
    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
    return cleanGeminiText(rawText);
  } catch (error) {
    console.error('Error fetching response from Gemini:', error);
    throw error;
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

    const pastContext = memories?.length
      ? memories.map(m => `User: ${m.query}\nAgent: ${m.response}`).join('\n')
      : 'No previous context available.';

    let resultData = {};

    if (contextAction === 'trending') {
      const videos = await fetchTrendingVideos(query);
      const shorts = await fetchTrendingShorts(query);
      resultData = {
        trendingVideos: videos,
        trendingShorts: shorts
      };
    } else if (contextAction === 'script') {
      const prompt = `Based on the following conversation context:\n\n${pastContext}\n\nGenerate a YouTube script structure including:\n- Introduction (0:00 - 0:45): Hook the viewer.\n- Section 1 (0:45 - 3:00): Topic Overview.\n- Section 2 (3:00 - 7:00): Detailed Explanation.\n- Section 3 (7:00 - 10:00): Case Studies/Examples.\n- Call to Action (10:00 - 10:30): Invite the viewer to engage.`;
      resultData = await getGeminiResponse(prompt);
    } else if (contextAction === 'research') {
      const prompt = `Generate a structured research overview for the topic \"${query}\" including:\n- A concise topic overview.\n- Uniqueness analysis.\n- A list of suggested ideas.\n- Implementation methods with examples.`;
      resultData = await getGeminiResponse(prompt);
    } else if (contextAction === 'video-idea') {
      resultData = await getGeminiResponseFromSearch(query);
    } else {
      const prompt = `User asked: \"${query}\"\n\nConversation history:\n${pastContext}\n\nPlease provide a thoughtful and detailed response.`;
      resultData = await getGeminiResponse(prompt);
    }

    const { error: insertError } = await supabase
      .from('memories')
      .insert([
        {
          user_id: userId,
          conversation_id: conversationId,
          query,
          response: typeof resultData === 'string' ? resultData : JSON.stringify(resultData, null, 2),
          embedding
        }
      ]);

    if (insertError) console.error('Insert error:', insertError);

    return res.status(200).json({ response: resultData });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}