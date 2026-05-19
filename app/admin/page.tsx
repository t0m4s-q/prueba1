'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserPlus, Loader2, CheckCircle } from 'lucide-react';

export default function AdminPage() {
  const [sedes, setSedes] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rolCodigo: 'recepcionista',
    // Especialista
    matricula: '',
    especialidad_id: '',
    sedesEspecialista: [] as number[],
    // Recepcionista
    sede_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: s } = await supabase.from('sedes').select('*');
    const { data: e } = await supabase.from('especialidades').select('*');
    if (s) setSedes(s);
    if (e) setEspecialidades(e);
  };

  const handleSedesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Array.from(e.target.selectedOptions, option => Number(option.value));
    setFormData({ ...formData, sedesEspecialista: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const extraData: any = {};
      
      if (formData.rolCodigo === 'especialista') {
         extraData.matricula = formData.matricula;
         extraData.especialidad_id = Number(formData.especialidad_id);
         extraData.sedes = formData.sedesEspecialista;
      } else if (formData.rolCodigo === 'recepcionista') {
         extraData.sede_id = Number(formData.sede_id);
      }

      const res = await fetch('/api/auth/register-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nombre: formData.nombre,
          apellido: formData.apellido,
          rolCodigo: formData.rolCodigo,
          extraData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMessage('¡Personal registrado exitosamente!');
      // reset partial
      setFormData({ ...formData, email: '', password: '', nombre: '', apellido: '', matricula: '' });
      setTimeout(() => setMessage(''), 3000);
      
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Panel de Control General</h2>
        <p className="text-sm text-gray-500 mb-6">
          Gestión de personal de la clínica.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
        <h3 className="text-lg font-medium text-gray-900 flex items-center mb-6">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
          Registrar Nuevo Personal
        </h3>
        
        {message && (
           <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg flex items-center text-sm border border-green-200">
             <CheckCircle className="w-4 h-4 mr-2" />
             {message}
           </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido</label>
                <input required type="text" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña temporal</label>
                <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-700">Rol a asignar</label>
              <select value={formData.rolCodigo} onChange={e => setFormData({...formData, rolCodigo: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="recepcionista">Recepcionista</option>
                <option value="especialista">Especialista</option>
                <option value="admin">Administrador</option>
              </select>
           </div>
           
           {/* Formulario Dinámico según Rol */}
           {formData.rolCodigo === 'recepcionista' && (
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
               <label className="block text-sm font-medium text-gray-700">Sede Asignada</label>
               <select required value={formData.sede_id} onChange={e => setFormData({...formData, sede_id: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                 <option value="">Seleccione una sede...</option>
                 {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
               </select>
             </div>
           )}

           {formData.rolCodigo === 'especialista' && (
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Matrícula (MP/MN)</label>
                    <input required type="text" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Especialidad</label>
                    <select required value={formData.especialidad_id} onChange={e => setFormData({...formData, especialidad_id: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                      <option value="">Seleccione...</option>
                      {especialidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sedes donde atiende (Multiple)</label>
                  <select multiple required value={formData.sedesEspecialista.map(String)} onChange={handleSedesChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-24">
                     {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Mantenga presionado Ctrl (o Cmd) para seleccionar múltiples.</p>
               </div>
             </div>
           )}

           <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar Usuario
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
