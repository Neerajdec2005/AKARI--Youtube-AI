import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [userId] = useState('user123');
  const [conversationId, setConversationId] = useState('');
  const [query, setQuery] = useState('');
  const [contextAction, setContextAction] = useState('trending');
  const [messages, setMessages] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const isResizing = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!conversationId) setConversationId(Date.now().toString());
  }, [conversationId]);

  const safeParse = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  useEffect(() => {
    async function fetchChats() {
      try {
        const res = await fetch(`/api/chats?userId=${userId}`);
        const data = await res.json();
        if (res.ok) setChatList(data.chats);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    }
    fetchChats();
  }, [userId]);

  useEffect(() => {
    if (!conversationId) return;
    async function fetchMemories() {
      try {
        const res = await fetch(`/api/memories?userId=${userId}&conversationId=${conversationId}`);
        const data = await res.json();
        if (res.ok) {
          const formatted = data.memories.map(memory => ({
            query: memory.query,
            response: safeParse(memory.response),
            created_at: memory.created_at,
          }));
          setMessages(formatted);
        }
      } catch (error) {
        console.error('Error fetching memories:', error);
      }
    }
    fetchMemories();
  }, [userId, conversationId]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, conversationId, query, contextAction })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          { query, response: data.response, created_at: new Date().toISOString() }
        ]);
      } else {
        console.error('Error:', data.error);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
    setLoading(false);
    setQuery('');
  };

  const handleNewChat = () => {
    const newConvId = Date.now().toString();
    setConversationId(newConvId);
    setMessages([]);
    setChatList(prev => [{ conversation_id: newConvId, created_at: new Date().toISOString() }, ...prev]);
  };

  const handleSelectChat = chatId => setConversationId(chatId);

  const handleMouseDown = () => {
    isResizing.current = true;
  };

  const handleMouseMove = (e) => {
    if (isResizing.current) {
      const newWidth = Math.min(Math.max(e.clientX, 200), 500);
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${sidebarWidth}px`,
        background: '#fff',
        borderRight: '1px solid #ccc',
        padding: '1rem',
        overflowY: 'auto',
        boxSizing: 'border-box',
        zIndex: 5
      }}>
        <h2>AKARI (YoutubeAI)</h2>
        <button
          onClick={handleNewChat}
          style={{ marginBottom: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          New Chat
        </button>
        {chatList.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {chatList.map((chat, idx) => (
              <li
                key={idx}
                style={{
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  color: chat.conversation_id === conversationId ? 'blue' : 'black'
                }}
                onClick={() => handleSelectChat(chat.conversation_id)}
              >
                Chat {chat.conversation_id}
              </li>
            ))}
          </ul>
        ) : (
          <p>No chats yet.</p>
        )}
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: `${sidebarWidth}px`,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          backgroundColor: '#ccc',
          zIndex: 6
        }}
      />

      {/* Chat Canvas */}
      <div style={{
        position: 'fixed',
        left: `${sidebarWidth + 5}px`,
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        backgroundColor: '#f4f4f4',
        overflowX: 'hidden',
        overflowY: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Messages */}
        <div style={{
          flexGrow: 1,
          overflowY: 'auto',
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 0 5px rgba(0,0,0,0.05)'
        }}>
          {messages.length > 0 ? (
            messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>You: {msg.query}</p>
                <div style={{
                  margin: '0.5rem 0',
                  padding: '0.5rem',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowX: 'auto'
                }}>
                  <strong>Akari:</strong>{' '}
                  {typeof msg.response === 'object'
                    ? <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        overflowX: 'auto'
                      }}>{JSON.stringify(msg.response, null, 2)}</pre>
                    : msg.response}
                </div>
                <hr />
              </div>
            ))
          ) : (
            <p>No messages in this chat yet.</p>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{
          marginTop: '1rem',
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #ccc',
          boxShadow: '0 0 5px rgba(0,0,0,0.05)'
        }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>
              Action:&nbsp;
              <select value={contextAction} onChange={(e) => setContextAction(e.target.value)}>
                <option value="trending">Trending Topics</option>
                <option value="research">Research Articles</option>
                <option value="script">Script Improvement</option>
                <option value="default">General Query</option>
              </select>
            </label>
          </div>
          <textarea
            placeholder="Enter your query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            style={{ width: '100%', marginBottom: '5px' }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
