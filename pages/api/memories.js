import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests allowed' });
  }
  
  const { userId, conversationId } = req.query;
  
  try {
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    return res.status(200).json({ memories });
  } catch (error) {
    console.error('Memories API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
