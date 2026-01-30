import { useEffect, useState } from 'react';
import api from '../lib/api';
import { UserPlus, Shield, User, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  maxConcurrentChats: number;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente',
};

const statusLabels: Record<string, { label: string; class: string }> = {
  online: { label: 'Online', class: 'badge-green' },
  away: { label: 'Ausente', class: 'badge-yellow' },
  offline: { label: 'Offline', class: 'badge-gray' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });

  const loadUsers = () => {
    api.get('/users')
      .then(({ data }) => setUsers(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const createUser = async () => {
    try {
      await api.post('/users', newUser);
      toast.success('Usuário criado');
      setShowCreate(false);
      setNewUser({ name: '', email: '', password: '', role: 'agent' });
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const toggleUser = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/users/${id}`, { isActive: !isActive });
      toast.success(isActive ? 'Usuário desativado' : 'Usuário ativado');
      loadUsers();
    } catch (err) {
      toast.error('Erro ao atualizar usuário');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <p className="text-gray-500 mt-1">Gerencie operadores e agentes</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>

        {showCreate && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Novo Usuário</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input type="password" className="input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="agent">Agente</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createUser} className="btn-primary">Criar Usuário</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Usuário</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Função</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Chats Simultâneos</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge badge-blue flex items-center gap-1 w-fit">
                      <Shield className="w-3 h-3" /> {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${statusLabels[u.status]?.class || 'badge-gray'}`}>
                      {statusLabels[u.status]?.label || u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.maxConcurrentChats}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUser(u.id, u.isActive)}
                      className={`text-xs font-medium ${u.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {u.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
