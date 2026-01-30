import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  Building2, Plus, Trash2, Users, UserPlus, Activity, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  isActive: boolean;
  priority: number;
  welcomeMessage: string;
  members: Array<{
    id: string;
    userId: string;
    skills: string[];
    skillLevel: number;
    user: { id: string; name: string; email: string };
  }>;
}

interface QueueStats {
  departments: Array<{
    department: { id: string; name: string; color: string };
    waiting: number;
    active: number;
    totalMembers: number;
    onlineMembers: number;
  }>;
  unassigned: number;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Department | null>(null);
  const [newDept, setNewDept] = useState({ name: '', description: '', color: '#6366f1', priority: 0, welcomeMessage: '' });
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberSkills, setAddMemberSkills] = useState('');
  const [addMemberLevel, setAddMemberLevel] = useState(5);

  const loadData = () => {
    Promise.all([
      api.get('/departments'),
      api.get('/departments/queue/stats'),
      api.get('/users'),
    ]).then(([deptRes, statsRes, usersRes]) => {
      setDepartments(deptRes.data);
      setQueueStats(statsRes.data);
      setUsers(usersRes.data);
      if (deptRes.data.length > 0 && !selected) {
        setSelected(deptRes.data[0]);
      }
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const createDept = async () => {
    try {
      await api.post('/departments', newDept);
      toast.success('Departamento criado');
      setShowCreate(false);
      setNewDept({ name: '', description: '', color: '#6366f1', priority: 0, welcomeMessage: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar departamento');
    }
  };

  const deleteDept = async (id: string) => {
    if (!confirm('Excluir este departamento?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Departamento excluído');
      if (selected?.id === id) setSelected(null);
      loadData();
    } catch (err) {
      toast.error('Erro ao excluir departamento');
    }
  };

  const addMember = async () => {
    if (!selected || !addMemberUserId) return;
    try {
      await api.post(`/departments/${selected.id}/members`, {
        userId: addMemberUserId,
        skills: addMemberSkills.split(',').map(s => s.trim()).filter(Boolean),
        skillLevel: addMemberLevel,
      });
      toast.success('Membro adicionado');
      setAddMemberUserId('');
      setAddMemberSkills('');
      setAddMemberLevel(5);
      loadData();
    } catch (err) {
      toast.error('Erro ao adicionar membro');
    }
  };

  const removeMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api.delete(`/departments/${selected.id}/members/${userId}`);
      toast.success('Membro removido');
      loadData();
    } catch (err) {
      toast.error('Erro ao remover membro');
    }
  };

  const processQueue = async () => {
    try {
      const { data } = await api.post('/departments/queue/process');
      toast.success(`${data.routed} conversas roteadas`);
      loadData();
    } catch (err) {
      toast.error('Erro ao processar fila');
    }
  };

  const existingMemberIds = selected?.members?.map(m => m.userId) || [];
  const availableUsers = users.filter(u => !existingMemberIds.includes(u.id));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Departamentos & Filas</h1>
            <p className="text-gray-500 mt-1">Gerencie departamentos e roteamento inteligente</p>
          </div>
          <div className="flex gap-2">
            <button onClick={processQueue} className="btn-secondary flex items-center gap-2">
              <Activity className="w-4 h-4" /> Processar Fila
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo Departamento
            </button>
          </div>
        </div>

        {/* Queue overview */}
        {queueStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {queueStats.departments.map(s => (
              <div key={s.department.id} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.department.color }} />
                  <h3 className="text-sm font-semibold text-gray-900">{s.department.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Na fila</span>
                    <p className="text-lg font-bold text-orange-500">{s.waiting}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Ativos</span>
                    <p className="text-lg font-bold text-green-500">{s.active}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Agentes</span>
                    <p className="text-lg font-bold text-gray-700">{s.totalMembers}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Online</span>
                    <p className="text-lg font-bold text-blue-500">{s.onlineMembers}</p>
                  </div>
                </div>
              </div>
            ))}
            {queueStats.unassigned > 0 && (
              <div className="card p-4 border-orange-200 bg-orange-50">
                <h3 className="text-sm font-semibold text-orange-800 mb-2">Sem departamento</h3>
                <p className="text-2xl font-bold text-orange-600">{queueStats.unassigned}</p>
                <p className="text-xs text-orange-500">conversas aguardando</p>
              </div>
            )}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Novo Departamento</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input className="input" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} placeholder="Ex: Vendas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={newDept.color} onChange={(e) => setNewDept({ ...newDept, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <input className="input flex-1" value={newDept.color} onChange={(e) => setNewDept({ ...newDept, color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade (0-10)</label>
                <input type="number" className="input" value={newDept.priority} onChange={(e) => setNewDept({ ...newDept, priority: parseInt(e.target.value) || 0 })} min="0" max="10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input className="input" value={newDept.description} onChange={(e) => setNewDept({ ...newDept, description: e.target.value })} placeholder="Descrição do departamento" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de Boas-vindas</label>
                <input className="input" value={newDept.welcomeMessage} onChange={(e) => setNewDept({ ...newDept, welcomeMessage: e.target.value })} placeholder="Mensagem enviada quando conversa entra neste departamento" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createDept} className="btn-primary">Criar</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
        ) : (
          <div className="flex gap-6">
            {/* Department list */}
            <div className="w-64 space-y-2">
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => setSelected(dept)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selected?.id === dept.id ? 'bg-primary-50 border border-primary-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{dept.name}</p>
                      <p className="text-xs text-gray-500">{dept.members?.length || 0} membros</p>
                    </div>
                  </div>
                </button>
              ))}
              {departments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum departamento</p>
              )}
            </div>

            {/* Department detail */}
            {selected && (
              <div className="flex-1 card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selected.color }} />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
                      <p className="text-sm text-gray-500">{selected.description || 'Sem descrição'}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteDept(selected.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {selected.welcomeMessage && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-blue-600 mb-1">Mensagem de boas-vindas:</p>
                    <p className="text-sm text-blue-800">{selected.welcomeMessage}</p>
                  </div>
                )}

                {/* Members */}
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Membros ({selected.members?.length || 0})
                </h3>

                {/* Add member */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">Adicionar membro</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <select className="input" value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)}>
                        <option value="">Selecionar agente...</option>
                        {availableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-40">
                      <input className="input" placeholder="Skills (ex: vendas, técnico)" value={addMemberSkills} onChange={(e) => setAddMemberSkills(e.target.value)} />
                    </div>
                    <div className="w-20">
                      <input type="number" className="input" min="1" max="10" value={addMemberLevel} onChange={(e) => setAddMemberLevel(parseInt(e.target.value) || 5)} title="Nível de skill (1-10)" />
                    </div>
                    <button onClick={addMember} className="btn-primary px-3 flex items-center gap-1">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Member list */}
                <div className="space-y-2">
                  {selected.members?.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {member.user?.name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.user?.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">Nível {member.skillLevel}/10</span>
                            {member.skills?.map((s, i) => (
                              <span key={i} className="badge badge-blue text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeMember(member.userId)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!selected.members || selected.members.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum membro neste departamento</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
