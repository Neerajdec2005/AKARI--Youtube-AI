import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests allowed' });
  }
  
  const { userId } = req.query;
  
  try {
    // Retrieve all chat records for the user.
    const { data, error } = await supabase
      .from('memories')
      .select('conversation_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Filter out duplicate conversation IDs.
    const seen = new Set();
    const chats = [];
    data.forEach(chat => {
      if (!seen.has(chat.conversation_id)) {
        seen.add(chat.conversation_id);
        chats.push(chat);
      }
    });
    
    return res.status(200).json({ chats });
  } catch (error) {
    console.error('Chats API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
