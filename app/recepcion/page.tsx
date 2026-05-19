'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Search, PlusCircle, Users, XCircle, UserPlus, CheckCircle } from 'lucide-react';

export default function RecepcionPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Datos base
  const [recepcionista, setRecepcionista] = useState<any>(null);
  const [especialistas, setEspecialistas] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  
  // Monitor de fila
  const [turnos, setTurnos] = useState<any[]>([]);
  
  // Formulario nuevo turno
  const [dni, setDni] = useState('');
  const [pacienteBuscado, setPacienteBuscado] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedEspecialista, setSelectedEspecialista] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  useEffect(() => {
    if (recepcionista?.sede_id) {
      const channel = supabase
        .channel('turnos_recepcion')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'turnos',
            filter: `sede_id=eq.${recepcionista.sede_id}`,
          },
          () => {
            fetchTurnos(recepcionista.sede_id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [recepcionista]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Obtener datos del recepcionista (su sede)
      const { data: recDataRaw, error: recError } = await supabase
        .from('recepcionistas')
        .select(`
          sede_id, 
          sedes ( nombre )
        `)
        .eq('profile_id', user!.id)
        .single();
        
      if (recError && recError.code !== 'PGRST116') throw recError; // PGRST116 is not found
      
      let recData: any = recDataRaw;
      let sedeId = recData?.sede_id;
      
      // Si no tiene sede_id (por mala data inicial), usamos 1 por default o mostramos error.
      if (!sedeId) {
        console.warn("Recepcionista sin sede asignada.");
        // Intentaremos usar una sede por defecto para que la UI funcione
        const {data: primeraSedeRaw } = await supabase.from('sedes').select('id, nombre').limit(1).single();
        const primeraSede: any = primeraSedeRaw;
        
        if (primeraSede) {
          sedeId = primeraSede.id;
          recData = { sede_id: sedeId, sedes: { nombre: primeraSede.nombre } };
        }
      }
      
      setRecepcionista(recData);

      if (sedeId) {
        // Traer especialistas de esa sede
        const { data: espData, error: espError } = await supabase
          .from('especialistas_sedes')
          .select(`
            especialista_id,
            especialistas (
              matricula,
              profiles (nombre, apellido),
              especialidades (nombre)
            )
          `)
          .eq('sede_id', sedeId);
          
        if (espError) throw espError;
        setEspecialistas(espData || []);
        
        // Traer estados
        const { data: estData } = await supabase.from('estados_turno').select('*');
        setEstados(estData || []);
        
        await fetchTurnos(sedeId);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTurnos = async (sedeId: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('turnos')
        .select(`
          id, posicion_fila, fecha_turno, estado_id,
          estados_turno!inner(codigo, descripcion),
          pacientes(dni, profiles(nombre, apellido)),
          especialistas(profiles(nombre, apellido))
        `)
        .eq('sede_id', sedeId)
        .eq('fecha_turno', today)
        .in('estados_turno.codigo', ['en_espera', 'atendiendo'])
        .order('posicion_fila', { ascending: true });
        
      if (error) throw error;
      setTurnos(data || []);
    } catch (error) {
      console.error('Error fetching turnos:', error);
    }
  };

  const handleSearchPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setPacienteBuscado(null);
    setActionLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select(`
          profile_id,
          dni,
          profiles!inner(nombre, apellido)
        `)
        .eq('dni', dni)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
           setSearchError('Paciente no encontrado. Debe registrarse en el portal primero.');
        } else {
           throw error;
        }
      } else {
        setPacienteBuscado(data);
      }
    } catch (err: any) {
      setSearchError('Error al buscar paciente');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTurno = async () => {
    if (!pacienteBuscado || !selectedEspecialista || !recepcionista?.sede_id) return;
    setActionLoading(true);
    
    try {
      const estadoEspera = estados.find(e => e.codigo === 'en_espera');
      const today = new Date().toISOString().split('T')[0];
      
      // Calcular posicion_fila
      // Buscamos los turnos de hoy para ese especialista, sede, y estados en_espera o atendiendo
      const { data: filaActual, error: filaError } = await supabase
        .from('turnos')
        .select('posicion_fila, estados_turno!inner(codigo)')
        .eq('especialista_id', selectedEspecialista)
        .eq('sede_id', recepcionista.sede_id)
        .eq('fecha_turno', today)
        .in('estados_turno.codigo', ['en_espera', 'atendiendo']);
        
      if (filaError) throw filaError;
      
      let maxPos = 0;
      filaActual?.forEach((t: any) => {
         if (t.posicion_fila && t.posicion_fila > maxPos) maxPos = t.posicion_fila;
      });
      
      const nextPosicion = maxPos + 1;
      
      const turnoAInsertar: any = {
           paciente_id: pacienteBuscado.profile_id,
           especialista_id: selectedEspecialista,
           sede_id: recepcionista.sede_id,
           estado_id: estadoEspera.id,
           posicion_fila: nextPosicion,
           fecha_turno: today
      };

      const { error: insertError } = await supabase
        .from('turnos')
        .insert(turnoAInsertar);
        
      if (insertError) throw insertError;
      
      // Resetear form
      setDni('');
      setPacienteBuscado(null);
      setSelectedEspecialista('');
      alert('Turno creado exitosamente');
      
      // Actualizar vista localmente
      fetchTurnos(recepcionista.sede_id);
    } catch (err: any) {
       alert('Error al crear turno: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTurno = async (turnoId: string) => {
    if (!confirm('¿Está seguro de cancelar este turno?')) return;
    try {
      const estadoCancelado = estados.find(e => e.codigo === 'cancelado');
      const updatePayload: any = { estado_id: estadoCancelado.id, posicion_fila: null };
      
      const { error } = await supabase
        // @ts-ignore
        .from('turnos')
        // @ts-ignore
        .update(updatePayload)
        .eq('id', turnoId);
        
      if (error) throw error;
      
      // Asíncrono real time trigger de notificaciones a los demás
      fetch('/api/notifications/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialista_id: selectedEspecialista || turnos.find(t => t.id === turnoId)?.especialista_id, sede_id: recepcionista.sede_id })
      }).catch(console.error);

      fetchTurnos(recepcionista.sede_id);
    } catch (err: any) {
      alert('Error al cancelar turno: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-gray-900">
           Sede {recepcionista?.sedes?.nombre || 'Desconocida'}
         </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Lado izquierdo: Crear Turno */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
               <UserPlus className="w-5 h-5 mr-2 text-blue-600" /> Ingresar Paciente
            </h3>
            
            {!pacienteBuscado ? (
              <form key="form-buscar" onSubmit={handleSearchPaciente} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">DNI del Paciente</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      required
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Ej: 35123456"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {searchError && <p className="text-sm text-red-600">{searchError}</p>}
              </form>
            ) : (
              <div key="form-encontrado" className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-start">
                   <div>
                     <p className="text-sm font-bold text-blue-900">
                        {(pacienteBuscado.profiles as any)?.nombre} {(pacienteBuscado.profiles as any)?.apellido}
                     </p>
                     <p className="text-xs text-blue-700">DNI: {pacienteBuscado.dni}</p>
                   </div>
                   <button onClick={() => setPacienteBuscado(null)} className="text-blue-400 hover:text-blue-600">
                      <XCircle className="w-5 h-5" />
                   </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialista a asignar</label>
                  <select
                    required
                    value={selectedEspecialista}
                    onChange={(e) => setSelectedEspecialista(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Seleccione un especialista...</option>
                    {especialistas.map((rel: any) => (
                      <option key={rel.especialista_id} value={rel.especialista_id}>
                        {rel.especialistas.especialidades?.nombre} - Dr/a. {rel.especialistas.profiles?.nombre} {rel.especialistas.profiles?.apellido}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleCreateTurno}
                  disabled={!selectedEspecialista || actionLoading}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                  Confirmar Turno
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lado derecho: Monitor de fila */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                 <Users className="w-5 h-5 mr-2 text-gray-500" /> Fila Virtual de Hoy
              </h3>
              <span className="bg-white px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 shadow-sm">
                {turnos.length} pacientes
              </span>
            </div>
            
            {turnos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Orden</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paciente</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Especialista</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {turnos.map((turno) => (
                      <tr key={turno.id} className={turno.estados_turno?.codigo === 'atendiendo' ? 'bg-green-50/50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className="text-lg font-bold text-gray-900">#{turno.posicion_fila}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {(turno.pacientes as any)?.profiles?.nombre} {(turno.pacientes as any)?.profiles?.apellido}
                          </div>
                          <div className="text-sm text-gray-500">DNI: {(turno.pacientes as any)?.dni}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           Dr/a. {(turno.especialistas as any)?.profiles?.nombre} {(turno.especialistas as any)?.profiles?.apellido}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                            turno.estados_turno?.codigo === 'atendiendo'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          }`}>
                            {turno.estados_turno?.codigo === 'atendiendo' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {turno.estados_turno?.descripcion}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {turno.estados_turno?.codigo === 'en_espera' && (
                            <button
                              onClick={() => handleCancelTurno(turno.id)}
                              className="text-red-600 hover:text-red-900 font-semibold text-xs"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <Users className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pacientes</h3>
                <p className="mt-1 text-sm text-gray-500">La sala de espera de la sede está vacía actualmente.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
