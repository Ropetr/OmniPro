import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  MessageSquare, Users, Radio, Bot, TrendingUp, Inbox,
} from 'lucide-react';

interface Stats {
  totalConversations: number;
  openConversations: number;
  totalContacts: number;
  totalMessages: number;
  todayConversations: number;
  channelsCount: number;
  activeChannels: number;
  conversationsByChannel: Array<{ channelType: string; count: string }>;
}

const channelLabels: Record<string, string> = {
  webchat: 'Chat do Site',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  mercadolivre: 'MercadoLivre',
  email: 'Email',
};

const channelColors: Record<string, string> = {
  webchat: 'bg-blue-500',
  whatsapp: 'bg-green-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  mercadolivre: 'bg-yellow-500',
  email: 'bg-red-500',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(({ data }) => setStats(data))
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const statCards = [
    { label: 'Conversas Abertas', value: stats.openConversations, icon: Inbox, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Total de Conversas', value: stats.totalConversations, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Contatos', value: stats.totalContacts, icon: Users, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Mensagens', value: stats.totalMessages, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Canais Ativos', value: stats.activeChannels, icon: Radio, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Conversas Hoje', value: stats.todayConversations, icon: Bot, color: 'text-pink-500', bg: 'bg-pink-50' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral do seu atendimento</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`${card.bg} p-3 rounded-lg`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Conversations by channel */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversas por Canal</h2>
          {stats.conversationsByChannel.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma conversa registrada ainda</p>
          ) : (
            <div className="space-y-3">
              {stats.conversationsByChannel.map((ch) => {
                const total = stats.totalConversations || 1;
                const pct = Math.round((parseInt(ch.count) / total) * 100);
                return (
                  <div key={ch.channelType}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{channelLabels[ch.channelType] || ch.channelType}</span>
                      <span className="text-gray-500">{ch.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${channelColors[ch.channelType] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
