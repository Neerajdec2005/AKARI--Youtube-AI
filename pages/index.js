import { useState, useEffect, useRef } from 'react';
//
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
  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    let accumulatedResponse = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, conversationId, query, contextAction })
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error:', errorData.error);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      setMessages(prev => [
        ...prev,
        { query, response: '', created_at: new Date().toISOString() }
      ]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedResponse += chunk;

          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            lastMessage.response = accumulatedResponse;
            return newMessages;
          });
        }
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
    <>
    <style jsx global>{`
      html, body {
        background-color: #000;
        margin: 0;
        padding: 0;
      }
    `}</style>
    <div style={{ fontFamily: 'sans-serif', height: '100vh', display: 'flex', overflow: 'hidden' , backgroundColor: 'black'}}>
      {/* Sidebar */}
      <div style={{
        width: `${sidebarWidth}px`,
        background: '#202123',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        boxSizing: 'border-box',
        overflowY: 'auto',
        zIndex: 5
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontFamily:"TimesNewRoman"}}>AKARI (YoutubeAI)</h2>
        <button
          onClick={handleNewChat}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            backgroundColor: '#3e3f40',
            border: 'none',
            color: '#fff',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          + New Chat
        </button>
        {chatList.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1 }}>
            {chatList.map((chat, idx) => (
              <li
                key={idx}
                style={{
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: chat.conversation_id === conversationId ? '#444654' : 'transparent',
                  color: chat.conversation_id === conversationId ? '#fff' : '#ccc',
                  fontWeight: chat.conversation_id === conversationId ? 'bold' : 'normal'
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
          width: '5px',
          cursor: 'col-resize',
          backgroundColor: '#444654',
          zIndex: 6
        }}
      />

      {/* Chat Canvas */}
      {/* Chat Canvas */}
<div style={{
  width: '82%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#343541',
  color: '#fff',
  padding: '1rem',
  boxSizing: 'border-box',
  overflow: 'hidden',
  flexShrink: 0
}}>
  

        {/* Messages */}
        <div style={{
          flexGrow: 1,
          overflowY: 'auto',
          paddingRight: '1rem',
          marginBottom: '1rem',
          scrollbarWidth: 'thin',
          scrollbarColor: '#888 transparent'
        }}>
          {messages.length > 0 ? (
            messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#444654',
                  color: '#fff',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  maxWidth: '70%',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  <strong>You:</strong> {msg.query}
                </div>
                <div style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#202123',
                  color: '#fff',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginTop: '0.25rem',
                  maxWidth: '70%',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  border: '1px solid #555'
                }}>
                  <strong>Akari:</strong>{' '}
                  {Array.isArray(msg.response) && msg.response.every(line => typeof line === 'string')
                    ? msg.response.map((line, idx) => (
                        <div key={idx} style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginBottom: '0.25rem' }}>
                          {line}
                        </div>
                      ))
                    : typeof msg.response === 'object'
                    ? <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        overflowX: 'auto'
                      }}>{JSON.stringify(msg.response, null, 2)}</pre>
                    : msg.response}
                </div>
              </div>
            ))
          ) : (
            <p>No messages in this chat yet.</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#40414f',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #555',
          boxShadow: '0 0 5px rgba(0,0,0,0.2)'
        }}>
          <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
  {['trending', 'research', 'script', 'default'].map((option) => {
    const labels = {
      trending: 'Trending Topics',
      research: 'Research Articles',
      script: 'Script Improvement',
      default: 'General Query',
    };
    const isSelected = contextAction === option;
    return (
      <button
        key={option}
        type="button"
        onClick={() => setContextAction(option)}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          border: isSelected ? '2px solid #10a37f' : '2px solid transparent',
          backgroundColor: isSelected ? '#10a37f' : '#40414f',
          color: isSelected ? '#fff' : '#ccc',
          cursor: 'pointer',
          fontWeight: isSelected ? 'bold' : 'normal',
          flexGrow: 1,
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        }}
      >
        {labels[option]}
      </button>
    );
  })}
</div>

          <textarea
            placeholder="Enter your query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: '#202123',
              color: '#fff',
              resize: 'vertical',
              fontSize: '1rem',
              fontFamily: 'inherit'
            }}
            required
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: loading ? '#555' : '#10a37f',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '1rem',
              transition: 'background-color 0.3s ease'
            }}
          >
            {loading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
