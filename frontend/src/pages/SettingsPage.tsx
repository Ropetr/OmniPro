import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Palette, Globe, Clock, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { tenant } = useAuth();
  const [widgetColor, setWidgetColor] = useState('#4F46E5');
  const [welcomeMessage, setWelcomeMessage] = useState('Olá! Como podemos ajudar?');
  const [offlineMessage, setOfflineMessage] = useState('Estamos offline no momento. Deixe sua mensagem!');
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');

  const saveSettings = () => {
    toast.success('Configurações salvas (demonstração)');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 mt-1">Configure seu workspace {tenant?.name}</p>
        </div>

        {/* Widget Settings */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Palette className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Widget de Chat</h2>
              <p className="text-sm text-gray-500">Personalize a aparência do chat no seu site</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor Principal</label>
              <div className="flex items-center gap-3">
                <input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                <input className="input w-32" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} />
                <div className="w-10 h-10 rounded-full" style={{ backgroundColor: widgetColor }} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de Boas-vindas</label>
              <input className="input" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem Offline</label>
              <input className="input" value={offlineMessage} onChange={(e) => setOfflineMessage(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Horário de Atendimento</h2>
              <p className="text-sm text-gray-500">Defina quando sua equipe está disponível</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" checked={businessHoursEnabled} onChange={(e) => setBusinessHoursEnabled(e.target.checked)} />
              <span className="text-sm text-gray-700">Habilitar horário de atendimento</span>
            </label>

            {businessHoursEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuso Horário</label>
                <select className="input w-64" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Belem">Belém (GMT-3)</option>
                  <option value="America/Recife">Recife (GMT-3)</option>
                </select>

                <div className="mt-4 space-y-2">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => (
                    <div key={day} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 w-28">
                        <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" defaultChecked={i < 5} />
                        <span className="text-sm text-gray-700">{day}</span>
                      </label>
                      <input type="time" className="input w-32" defaultValue="08:00" />
                      <span className="text-gray-400">até</span>
                      <input type="time" className="input w-32" defaultValue={i < 5 ? '18:00' : '12:00'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
              <p className="text-sm text-gray-500">Configure alertas e notificações</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" defaultChecked />
              <span className="text-sm text-gray-700">Som de notificação para novas mensagens</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" defaultChecked />
              <span className="text-sm text-gray-700">Notificação no navegador</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm text-gray-700">Email para conversas não respondidas (após 5 min)</span>
            </label>
          </div>
        </div>

        <button onClick={saveSettings} className="btn-primary">
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
