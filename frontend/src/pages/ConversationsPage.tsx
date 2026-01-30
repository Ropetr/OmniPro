import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, Send, User, MoreVertical, Phone, MessageSquare,
  Globe, X, UserPlus, Archive,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Conversation {
  id: string;
  status: string;
  priority: string;
  subject: string;
  lastMessageAt: string;
  isBot: boolean;
  contact: { id: string; name: string; avatar: string; source: string; phone: string; email: string };
  channel: { id: string; name: string; type: string };
  assignedTo: { id: string; name: string } | null;
}

interface Message {
  id: string;
  content: string;
  type: string;
  sender: string;
  createdAt: string;
  agent?: { name: string };
  attachments?: Array<{ url: string; name: string; type: string }>;
}

const channelIcons: Record<string, string> = {
  webchat: '💬', whatsapp: '📱', instagram: '📸', facebook: '👤', mercadolivre: '🛒', email: '📧',
};

const statusColors: Record<string, string> = {
  open: 'badge-green', pending: 'badge-yellow', assigned: 'badge-blue', closed: 'badge-gray',
};

export default function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/conversations', { params });
      setConversations(data.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (selected) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    };

    const handleConversationUpdated = () => {
      loadConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('conversation_assigned', handleConversationUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('conversation_assigned', handleConversationUpdated);
    };
  }, [selected, loadConversations]);

  // Select conversation
  const selectConversation = async (conv: Conversation) => {
    setSelected(conv);
    try {
      const { data } = await api.get(`/conversations/${conv.id}/messages`);
      setMessages(data);
      scrollToBottom();

      // Join socket room
      const socket = getSocket();
      if (socket) socket.emit('join_conversation', conv.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selected || sending) return;
    setSending(true);

    try {
      const { data } = await api.post(`/conversations/${selected.id}/messages`, {
        content: newMessage.trim(),
      });
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      scrollToBottom();
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const assignToMe = async () => {
    if (!selected) return;
    try {
      await api.post(`/conversations/${selected.id}/assign`);
      toast.success('Conversa atribuída a você');
      loadConversations();
    } catch (err) {
      toast.error('Erro ao atribuir conversa');
    }
  };

  const closeConversation = async () => {
    if (!selected) return;
    try {
      await api.post(`/conversations/${selected.id}/close`);
      toast.success('Conversa encerrada');
      setSelected(null);
      loadConversations();
    } catch (err) {
      toast.error('Erro ao encerrar conversa');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Filter conversations
  const filtered = conversations.filter(c => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return c.contact?.name?.toLowerCase().includes(q)
      || c.channel?.type?.toLowerCase().includes(q)
      || c.subject?.toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex">
      {/* Conversation list */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Conversas</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Buscar conversas..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['', 'open', 'assigned', 'pending', 'closed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  statusFilter === s ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Todos' : s === 'open' ? 'Abertas' : s === 'assigned' ? 'Atribuídas' : s === 'pending' ? 'Pendentes' : 'Fechadas'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhuma conversa encontrada
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selected?.id === conv.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                    {channelIcons[conv.channel?.type] || '💬'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.contact?.name || 'Visitante'}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { locale: ptBR, addSuffix: true }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{conv.channel?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${statusColors[conv.status] || 'badge-gray'}`}>
                        {conv.status === 'open' ? 'Aberta' : conv.status === 'assigned' ? 'Atribuída' : conv.status === 'pending' ? 'Pendente' : 'Fechada'}
                      </span>
                      {conv.isBot && <span className="badge badge-blue">Bot</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                {channelIcons[selected.channel?.type] || '💬'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{selected.contact?.name}</p>
                <p className="text-xs text-gray-500">
                  {selected.channel?.name} {selected.contact?.phone ? `• ${selected.contact.phone}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.status !== 'assigned' && (
                <button onClick={assignToMe} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Atribuir a mim
                </button>
              )}
              {selected.status !== 'closed' && (
                <button onClick={closeConversation} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                  <Archive className="w-3.5 h-3.5" /> Encerrar
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'contact' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[70%] rounded-lg px-4 py-2.5 ${
                  msg.sender === 'contact' ? 'bg-white border border-gray-200 text-gray-900' :
                  msg.sender === 'bot' ? 'bg-blue-100 text-blue-900' :
                  msg.sender === 'system' ? 'bg-gray-200 text-gray-600 text-xs text-center max-w-full w-full' :
                  'bg-primary-600 text-white'
                }`}>
                  {msg.sender === 'agent' && msg.agent && (
                    <p className="text-xs opacity-70 mb-1">{msg.agent.name}</p>
                  )}
                  {msg.sender === 'bot' && (
                    <p className="text-xs text-blue-600 mb-1 font-medium">🤖 Bot</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender === 'contact' ? 'text-gray-400' : 'opacity-70'
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {selected.status !== 'closed' && (
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="btn-primary px-4"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">Selecione uma conversa</h3>
            <p className="text-sm text-gray-400 mt-1">Escolha uma conversa na lista ao lado para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}
