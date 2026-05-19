'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Users, CheckCircle, FileText, Activity, Clock, FileClock, X, Check } from 'lucide-react';

export default function EspecialistaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [sedes, setSedes] = useState<any[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(null);
  
  const [turnosHoy, setTurnosHoy] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  
  // Turno actual
  const [turnoEnAtencion, setTurnoEnAtencion] = useState<any>(null);
  const [observacionesLocal, setObservacionesLocal] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [historialPaciente, setHistorialPaciente] = useState<any[]>([]);
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Suscripción a cambios
  useEffect(() => {
    if (selectedSedeId && user) {
      const channel = supabase
        .channel('turnos_especialista')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'turnos',
            filter: `especialista_id=eq.${user.id}`,
          },
          () => {
            fetchTurnos(selectedSedeId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedSedeId, user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
       // Obtener sedes donde atiende el especialista
       const { data: espSedes, error: errorSedes } = await supabase
         .from('especialistas_sedes')
         .select('sede_id, sedes(nombre)')
         .eq('especialista_id', user!.id);
         
       if (errorSedes) throw errorSedes;
       
       const mappedSedes = espSedes?.map((es: any) => ({
          id: es.sede_id,
          nombre: es.sedes?.nombre
       })) || [];
       
       setSedes(mappedSedes);
       
       const { data: estData } = await supabase.from('estados_turno').select('*');
       setEstados(estData || []);
       
       if (mappedSedes.length > 0) {
          const firstSede = mappedSedes[0].id;
          setSelectedSedeId(firstSede);
          await fetchTurnos(firstSede);
       }
       
    } catch (err) {
       console.error("Error inicial", err);
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
          id, posicion_fila, fecha_turno, estado_id, observaciones,
          estados_turno!inner(codigo, descripcion),
          pacientes(profile_id, dni, profiles(nombre, apellido))
        `)
        .eq('especialista_id', user!.id)
        .eq('sede_id', sedeId)
        .eq('fecha_turno', today)
        .in('estados_turno.codigo', ['en_espera', 'atendiendo'])
        .order('posicion_fila', { ascending: true });
        
      if (error) throw error;
      
      const rawTurnos = data || [];
      const turnosAny: any[] = rawTurnos as any[];
      
      setTurnosHoy(turnosAny);
      
      // Auto seleccionar si hay uno atendiendo
      const atendiendo = turnosAny.find((t: any) => t.estados_turno?.codigo === 'atendiendo');
      if (atendiendo) {
         setTurnoEnAtencion(atendiendo);
         setObservacionesLocal(atendiendo.observaciones || '');
      } else {
         setTurnoEnAtencion(null);
         setObservacionesLocal('');
      }
      
    } catch (err) {
      console.error(err);
    }
  };

  const handleLlamarSiguiente = async () => {
     if (turnoEnAtencion) {
        alert("Primero debe finalizar la atención del paciente actual.");
        return;
     }
     
     const turnosEspera = turnosHoy.filter(t => t.estados_turno?.codigo === 'en_espera');
     if (turnosEspera.length === 0) return;
     
     const siguiente = turnosEspera[0];
     const estadoAtendiendo = estados.find(e => e.codigo === 'atendiendo');
     
     setActionLoading(true);
     try {
       // @ts-ignore
       const { error } = await supabase.from('turnos').update({ estado_id: estadoAtendiendo.id }).eq('id', siguiente.id);
       if (error) throw error;
       
       fetch('/api/notifications/process', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ especialista_id: user!.id, sede_id: selectedSedeId })
       }).catch(console.error);

       await fetchTurnos(selectedSedeId!);
     } catch (err: any) {
       alert("Error al llamar paciente: " + err.message);
     } finally {
       setActionLoading(false);
     }
  };

  const handleFinalizarAtencion = async () => {
    if (!turnoEnAtencion) return;
    
    if (!confirm('¿Finalizar atención?')) return;
    
    setActionLoading(true);
    const estadoFinalizado = estados.find(e => e.codigo === 'finalizado');
    try {
      // @ts-ignore
      const { error } = await supabase.from('turnos').update({
         estado_id: estadoFinalizado.id,
         observaciones: observacionesLocal,
         posicion_fila: null
      }).eq('id', turnoEnAtencion.id);
      
      if (error) throw error;

      fetch('/api/notifications/process', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ especialista_id: user!.id, sede_id: selectedSedeId })
      }).catch(console.error);

      await fetchTurnos(selectedSedeId!);
    } catch (err: any) {
      alert("Error al finalizar: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };
  
  const fetchHistorialPaciente = async (pacienteId: string) => {
     setActionLoading(true);
     try {
       const { data, error } = await supabase
         .from('turnos')
         .select(`
            fecha_turno,
            observaciones,
            sedes(nombre),
            especialistas(profiles(nombre, apellido)),
            estados_turno!inner(codigo)
         `)
         .eq('paciente_id', pacienteId)
         .eq('estados_turno.codigo', 'finalizado')
         .order('fecha_turno', { ascending: false });
         
       if (error) throw error;
       setHistorialPaciente((data as any[]) || []);
       setModalHistorialOpen(true);
     } catch (err: any) {
       alert("Error al cargar historial: " + err.message);
     } finally {
       setActionLoading(false);
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
    <div className="space-y-8 relative">
      
      {/* Filtro Sede */}
      {sedes.length > 1 && (
         <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <label className="text-sm font-medium text-gray-700 mr-4">Seleccione Sede para Atención:</label>
           <select 
             className="border border-gray-300 rounded-md py-1.5 px-3 text-sm"
             value={selectedSedeId || ''}
             onChange={(e) => {
               setSelectedSedeId(Number(e.target.value));
               fetchTurnos(Number(e.target.value));
             }}
           >
             {sedes.map(s => (
               <option key={s.id} value={s.id}>{s.nombre}</option>
             ))}
           </select>
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Lado Central: Consultorio Activo */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
            <h2 className="text-xl font-bold text-gray-900 flex items-center mb-6">
              <Activity className="w-6 h-6 mr-2 text-blue-600" /> Paciente en Atención
            </h2>
            
            {turnoEnAtencion ? (
              <div key="atendiendo" className="flex-1 flex flex-col">
                <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold text-green-900">
                        {turnoEnAtencion.pacientes?.profiles?.nombre} {turnoEnAtencion.pacientes?.profiles?.apellido}
                      </h3>
                      <p className="text-green-700 text-sm mt-1">DNI: {turnoEnAtencion.pacientes?.dni}</p>
                    </div>
                    <button
                       onClick={() => fetchHistorialPaciente(turnoEnAtencion.pacientes?.profile_id)}
                       className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-md text-green-700 bg-white hover:bg-green-50 transition-colors"
                    >
                      <FileClock className="w-4 h-4 mr-1" />
                      Ver Historial
                    </button>
                  </div>
                </div>

                <div className="flex-1 mb-6">
                   <label className="block text-sm font-medium text-gray-700 mb-2">Notas / Observaciones Clínicas</label>
                   <textarea
                     className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors resize-y text-sm"
                     placeholder="Escriba las observaciones del turno aquí..."
                     value={observacionesLocal}
                     onChange={(e) => setObservacionesLocal(e.target.value)}
                   />
                </div>

                <button
                  onClick={handleFinalizarAtencion}
                  disabled={actionLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                  Finalizar Turno
                </button>
              </div>
            ) : (
              <div key="libre" className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Consultorio Libre</h3>
                <p className="text-sm text-gray-500 mb-6">No hay ningún paciente en atención en este momento.</p>
                
                <button
                  onClick={handleLlamarSiguiente}
                  disabled={actionLoading || turnosHoy.filter(t => t.estados_turno?.codigo === 'en_espera').length === 0}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Llamar Siguiente Paciente
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lado derecho: Fila de hoy */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-[500px]">
             <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
               <h3 className="text-md font-medium text-gray-900 flex items-center justify-between">
                 <span className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-500" /> Próximos (Sala de Espera)</span>
                 <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                   {turnosHoy.filter(t => t.estados_turno?.codigo === 'en_espera').length}
                 </span>
               </h3>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {turnosHoy.filter(t => t.estados_turno?.codigo === 'en_espera').map((turno) => (
                  <div key={turno.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors flex items-center">
                    <div className="bg-blue-50 text-blue-700 font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-3  text-sm">
                      #{turno.posicion_fila}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {turno.pacientes?.profiles?.nombre} {turno.pacientes?.profiles?.apellido}
                      </p>
                      <p className="text-xs text-gray-500">DNI: {turno.pacientes?.dni}</p>
                    </div>
                  </div>
                ))}
                
                {turnosHoy.filter(t => t.estados_turno?.codigo === 'en_espera').length === 0 && (
                   <p className="text-center text-sm text-gray-500 mt-10">No hay pacientes esperando.</p>
                )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Modal Historial */}
      {modalHistorialOpen && (
         <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
               
               <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setModalHistorialOpen(false)}></div>

               <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
               
               <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                 <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200 flex justify-between items-center">
                   <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                     Historial Médico
                   </h3>
                   <button onClick={() => setModalHistorialOpen(false)} className="text-gray-400 hover:text-gray-500">
                     <X className="h-6 w-6" />
                   </button>
                 </div>
                 <div className="px-4 py-5 sm:p-6 max-h-[60vh] overflow-y-auto bg-gray-50">
                    {historialPaciente.length > 0 ? (
                      <div className="space-y-6">
                        {historialPaciente.map((h, i) => (
                           <div key={i} className="bg-white border text-sm border-gray-200 shadow-sm rounded-lg p-4">
                             <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                               <span className="font-medium text-gray-900 flex items-center">
                                  <FileText className="w-4 h-4 mr-1 text-gray-400" />
                                  {new Date(h.fecha_turno).toLocaleDateString()}
                               </span>
                               <span className="text-xs text-gray-500">
                                 Dr/a. {h.especialistas?.profiles?.nombre} {h.especialistas?.profiles?.apellido} - {h.sedes?.nombre}
                               </span>
                             </div>
                             <div className="text-gray-700 whitespace-pre-wrap">
                               {h.observaciones || <span className="text-gray-400 italic">Sin observaciones guardadas.</span>}
                             </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500">No hay atenciones finalizadas en el historial.</p>
                    )}
                 </div>
                 <div className="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
                   <button 
                     type="button" 
                     className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                     onClick={() => setModalHistorialOpen(false)}
                   >
                     Cerrar
                   </button>
                 </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
