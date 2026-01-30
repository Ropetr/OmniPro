import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Search, Mail, Phone, Tag, Globe } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  tags: string[];
  createdAt: string;
}

const sourceLabels: Record<string, string> = {
  webchat: 'Chat do Site', whatsapp: 'WhatsApp', instagram: 'Instagram',
  facebook: 'Facebook', mercadolivre: 'MercadoLivre', email: 'Email',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.get('/contacts', { params: { search: search || undefined } })
        .then(({ data }) => {
          setContacts(data.contacts);
          setTotal(data.total);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
            <p className="text-gray-500 mt-1">{total} contatos no total</p>
          </div>
        </div>

        {/* Search */}
        <div className="card p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Contacts table */}
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Canal</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum contato encontrado
                  </td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {contact.name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{contact.name || 'Sem nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {contact.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {contact.email}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {contact.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {contact.phone}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-blue">
                        <Globe className="w-3 h-3 mr-1" />
                        {sourceLabels[contact.source] || contact.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags?.map((tag, i) => (
                          <span key={i} className="badge badge-gray text-xs">
                            <Tag className="w-3 h-3 mr-0.5" /> {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
