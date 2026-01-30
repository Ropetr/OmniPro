import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  Globe, MessageSquare, Phone, Camera, Facebook, ShoppingBag,
  Mail, Plus, Settings, Power, Trash2, QrCode, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Channel {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  config: Record<string, any>;
  createdAt: string;
}

const channelMeta: Record<string, { icon: any; color: string; label: string; description: string }> = {
  webchat: { icon: Globe, color: 'bg-blue-500', label: 'Chat do Site', description: 'Widget de chat embeddable para seu site' },
  whatsapp: { icon: Phone, color: 'bg-green-500', label: 'WhatsApp', description: 'Integração via Evolution API' },
  instagram: { icon: Camera, color: 'bg-pink-500', label: 'Instagram', description: 'Direct Messages via Meta API' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook', description: 'Messenger via Meta API' },
  mercadolivre: { icon: ShoppingBag, color: 'bg-yellow-500', label: 'MercadoLivre', description: 'Mensagens de compradores' },
  email: { icon: Mail, color: 'bg-red-500', label: 'Email', description: 'IMAP/SMTP para receber e enviar emails' },
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', type: 'webchat' });

  const loadChannels = () => {
    api.get('/channels')
      .then(({ data }) => setChannels(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadChannels(); }, []);

  const createChannel = async () => {
    try {
      await api.post('/channels', newChannel);
      toast.success('Canal criado com sucesso');
      setShowCreate(false);
      setNewChannel({ name: '', type: 'webchat' });
      loadChannels();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar canal');
    }
  };

  const toggleChannel = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/channels/${id}`, { isActive: !isActive });
      toast.success(isActive ? 'Canal desativado' : 'Canal ativado');
      loadChannels();
    } catch (err) {
      toast.error('Erro ao atualizar canal');
    }
  };

  const deleteChannel = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este canal?')) return;
    try {
      await api.delete(`/channels/${id}`);
      toast.success('Canal excluído');
      loadChannels();
    } catch (err) {
      toast.error('Erro ao excluir canal');
    }
  };

  const getWidgetCode = (channel: Channel) => {
    const apiUrl = window.location.origin;
    return `<script src="${apiUrl.replace('3000', '3002')}/loader.js" data-channel-id="${channel.id}" data-api-url="${apiUrl.replace('3000', '3001')}"></script>`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Canais</h1>
            <p className="text-gray-500 mt-1">Gerencie seus canais de atendimento</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Canal
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Novo Canal</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  className="input"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  placeholder="Nome do canal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  className="input"
                  value={newChannel.type}
                  onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value })}
                >
                  {Object.entries(channelMeta).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createChannel} className="btn-primary">Criar Canal</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Channels grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => {
              const meta = channelMeta[channel.type] || channelMeta.webchat;
              const Icon = meta.icon;
              return (
                <div key={channel.id} className="card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`${meta.color} p-2.5 rounded-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{channel.name}</h3>
                        <p className="text-xs text-gray-500">{meta.label}</p>
                      </div>
                    </div>
                    <span className={`badge ${channel.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {channel.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-4">{meta.description}</p>

                  {/* WebChat widget code */}
                  {channel.type === 'webchat' && channel.isActive && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-1">Código do Widget:</p>
                      <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono overflow-x-auto">
                        {getWidgetCode(channel)}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp QR */}
                  {channel.type === 'whatsapp' && channel.isActive && (
                    <button
                      onClick={() => {
                        api.get(`/channels/${channel.id}/whatsapp/qrcode`)
                          .then(({ data }) => toast.success('QR Code gerado! Verifique o console.'))
                          .catch(() => toast.error('Configure a instância primeiro'));
                      }}
                      className="btn-secondary text-xs w-full mb-2 flex items-center justify-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Conectar WhatsApp
                    </button>
                  )}

                  {/* MercadoLivre OAuth */}
                  {channel.type === 'mercadolivre' && channel.isActive && (
                    <button
                      onClick={() => {
                        api.get(`/channels/${channel.id}/mercadolivre/auth-url`)
                          .then(({ data }) => window.open(data.url, '_blank'))
                          .catch(() => toast.error('Erro ao gerar URL de autenticação'));
                      }}
                      className="btn-secondary text-xs w-full mb-2 flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Conectar MercadoLivre
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleChannel(channel.id, channel.isActive)}
                      className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" />
                      {channel.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => deleteChannel(channel.id)}
                      className="btn-secondary text-xs text-red-600 border-red-200 hover:bg-red-50 px-3"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
