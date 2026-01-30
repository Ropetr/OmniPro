import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Bot, Plus, BookOpen, Brain, Trash2, TestTube, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface AIAgent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  autoReply: boolean;
  learnFromConversations: boolean;
  totalInteractions: number;
  satisfactionScore: number;
  knowledgeBases: KBEntry[];
}

interface KBEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  contentType: string;
  usageCount: number;
}

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selected, setSelected] = useState<AIAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', systemPrompt: '' });
  const [newKB, setNewKB] = useState({ title: '', content: '', contentType: 'faq' });
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<'config' | 'knowledge' | 'test'>('config');

  const loadAgents = () => {
    api.get('/ai/agents')
      .then(({ data }) => { setAgents(data); if (data.length > 0 && !selected) setSelected(data[0]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAgents(); }, []);

  const createAgent = async () => {
    try {
      await api.post('/ai/agents', newAgent);
      toast.success('Agente IA criado');
      setShowCreate(false);
      setNewAgent({ name: '', systemPrompt: '' });
      loadAgents();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar agente');
    }
  };

  const updateAgent = async () => {
    if (!selected) return;
    try {
      await api.put(`/ai/agents/${selected.id}`, {
        name: selected.name,
        systemPrompt: selected.systemPrompt,
        model: selected.model,
        temperature: selected.temperature,
        isActive: selected.isActive,
        autoReply: selected.autoReply,
        learnFromConversations: selected.learnFromConversations,
      });
      toast.success('Agente atualizado');
      loadAgents();
    } catch (err) {
      toast.error('Erro ao atualizar agente');
    }
  };

  const addKnowledge = async () => {
    if (!selected) return;
    try {
      await api.post(`/ai/agents/${selected.id}/knowledge`, newKB);
      toast.success('Conhecimento adicionado');
      setNewKB({ title: '', content: '', contentType: 'faq' });
      loadAgents();
    } catch (err) {
      toast.error('Erro ao adicionar conhecimento');
    }
  };

  const deleteKnowledge = async (id: string) => {
    try {
      await api.delete(`/ai/knowledge/${id}`);
      toast.success('Conhecimento removido');
      loadAgents();
    } catch (err) {
      toast.error('Erro ao remover conhecimento');
    }
  };

  const testAI = async () => {
    if (!selected || !testMessage) return;
    setTesting(true);
    setTestReply('');
    try {
      const { data } = await api.post(`/ai/agents/${selected.id}/test`, { message: testMessage });
      setTestReply(data.reply);
    } catch (err) {
      toast.error('Erro ao testar agente');
    } finally {
      setTesting(false);
    }
  };

  const triggerLearning = async () => {
    if (!selected) return;
    try {
      await api.post(`/ai/agents/${selected.id}/learn`);
      toast.success('Aprendizado processado');
    } catch (err) {
      toast.error('Erro ao processar aprendizado');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agentes de IA</h1>
            <p className="text-gray-500 mt-1">Configure seus assistentes inteligentes</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Agente
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Criar Agente de IA</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input className="input" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="Ex: Assistente de Vendas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt do Sistema</label>
                <textarea className="input h-24" value={newAgent.systemPrompt} onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })} placeholder="Descreva como o agente deve se comportar..." />
              </div>
              <div className="flex gap-2">
                <button onClick={createAgent} className="btn-primary">Criar</button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Nenhum agente de IA criado ainda</div>
        ) : (
          <div className="flex gap-6">
            {/* Agent list */}
            <div className="w-64 space-y-2">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { setSelected(agent); setTab('config'); }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selected?.id === agent.id ? 'bg-primary-50 border border-primary-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bot className={`w-5 h-5 ${selected?.id === agent.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.totalInteractions} interações</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Agent details */}
            {selected && (
              <div className="flex-1 card p-6">
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-200">
                  {[
                    { key: 'config', label: 'Configuração', icon: Bot },
                    { key: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
                    { key: 'test', label: 'Testar', icon: TestTube },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                  ))}
                </div>

                {/* Config tab */}
                {tab === 'config' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <input className="input" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prompt do Sistema</label>
                      <textarea className="input h-32" value={selected.systemPrompt || ''} onChange={(e) => setSelected({ ...selected, systemPrompt: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                        <select className="input" value={selected.model} onChange={(e) => setSelected({ ...selected, model: e.target.value })}>
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura: {selected.temperature}</label>
                        <input type="range" min="0" max="1" step="0.1" className="w-full" value={selected.temperature} onChange={(e) => setSelected({ ...selected, temperature: parseFloat(e.target.value) })} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" checked={selected.isActive} onChange={(e) => setSelected({ ...selected, isActive: e.target.checked })} />
                        <span className="text-sm text-gray-700">Agente ativo</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" checked={selected.autoReply} onChange={(e) => setSelected({ ...selected, autoReply: e.target.checked })} />
                        <span className="text-sm text-gray-700">Resposta automática</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" checked={selected.learnFromConversations} onChange={(e) => setSelected({ ...selected, learnFromConversations: e.target.checked })} />
                        <span className="text-sm text-gray-700">Aprender com conversas</span>
                      </label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={updateAgent} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
                      <button onClick={triggerLearning} className="btn-secondary flex items-center gap-2"><Brain className="w-4 h-4" /> Processar Aprendizado</button>
                    </div>
                  </div>
                )}

                {/* Knowledge tab */}
                {tab === 'knowledge' && (
                  <div>
                    <div className="card p-4 mb-4 bg-gray-50 border-dashed">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Adicionar Conhecimento</h4>
                      <div className="space-y-3">
                        <input className="input" placeholder="Título (ex: Horário de Funcionamento)" value={newKB.title} onChange={(e) => setNewKB({ ...newKB, title: e.target.value })} />
                        <textarea className="input h-20" placeholder="Conteúdo..." value={newKB.content} onChange={(e) => setNewKB({ ...newKB, content: e.target.value })} />
                        <select className="input" value={newKB.contentType} onChange={(e) => setNewKB({ ...newKB, contentType: e.target.value })}>
                          <option value="faq">FAQ</option>
                          <option value="text">Texto</option>
                          <option value="product">Produto</option>
                          <option value="procedure">Procedimento</option>
                        </select>
                        <button onClick={addKnowledge} className="btn-primary">Adicionar</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selected.knowledgeBases?.map(kb => (
                        <div key={kb.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{kb.title}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{kb.content}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-gray-400">{kb.source} • {kb.contentType} • {kb.usageCount} usos</span>
                            </div>
                          </div>
                          <button onClick={() => deleteKnowledge(kb.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(!selected.knowledgeBases || selected.knowledgeBases.length === 0) && (
                        <p className="text-sm text-gray-500 text-center py-4">Nenhum conhecimento cadastrado</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Test tab */}
                {tab === 'test' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">Teste o agente de IA enviando uma mensagem</p>
                    <div className="flex gap-2 mb-4">
                      <input className="input flex-1" placeholder="Digite uma mensagem de teste..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') testAI(); }} />
                      <button onClick={testAI} disabled={testing} className="btn-primary">
                        {testing ? 'Pensando...' : 'Enviar'}
                      </button>
                    </div>
                    {testReply && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-xs font-medium text-blue-600 mb-2">Resposta do Agente:</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{testReply}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
