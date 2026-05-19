'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Calendar, Clock, MapPin, User as UserIcon, RefreshCw } from 'lucide-react';

export default function PacientePage() {
  const { user } = useAuth();
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [pacientesAdelante, setPacientesAdelante] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTurnos();
    }
  }, [user]);

  // Suscripción a cambios
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('turnos_paciente')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turnos',
          filter: `paciente_id=eq.${user.id}`,
        },
        () => {
          fetchTurnos(); // Recargar si hay cambios en mis turnos (ej: me llamaron, me cancelaron)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Suscripción genérica para cuando avanza la fila de mi especialista
  useEffect(() => {
    if (!turnoActivo || turnoActivo.estados_turno?.codigo !== 'en_espera') return;

    // Si hay un turno activo, escuchamos a cualquier turno de ese especialista y sede en el día
    // (idealmente deberíamos filtrar por especialista, pero RLS no nos deja recibir updates de otros turnos por Realtime).
    // Así que hacemos un pooling cada 10 segundos del count, o depender del Realtime si las policies lo permitieran.
    // Dado que RLS oculta turnos, el Realtime NO notificará al paciente cuando el turno de OTRO paciente se actualiza.
    // Solución: Polling del count.
    
    const interval = setInterval(() => {
      fetchPacientesAdelante(turnoActivo.id);
    }, 10000);

    return () => clearInterval(interval);
  }, [turnoActivo]);

  const fetchTurnos = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Obtener todos los turnos del paciente
      const { data: turnos, error } = await supabase
        .from('turnos')
        .select(`
          id,
          fecha_turno,
          posicion_fila,
          estado_id,
          estados_turno ( codigo, descripcion ),
          especialistas ( 
            matricula,
            profiles (nombre, apellido)
          ),
          sedes ( nombre, direccion )
        `)
        .eq('paciente_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (turnos) {
        const turnosArr = turnos as any[];
        // Separar activo vs historial
        const activeEstados = ['en_espera', 'atendiendo'];
        const activo = turnosArr.find(
          (t: any) =>
            t.fecha_turno === today &&
            activeEstados.includes(t.estados_turno?.codigo as string)
        );

        setTurnoActivo(activo || null);
        setHistorial(turnosArr.filter((t: any) => t.id !== activo?.id));

        if (activo && activo.estados_turno?.codigo === 'en_espera') {
          await fetchPacientesAdelante(activo.id);
        }
      }
    } catch (err) {
      console.error('Error al cargar turnos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPacientesAdelante = async (turnoId: string) => {
    try {
      // @ts-ignore
      const { data, error } = await supabase.rpc('get_pacientes_adelante', {
        p_turno_id: turnoId,
      });
      if (error) throw error;
      setPacientesAdelante(data);
    } catch (err) {
      console.error('Error fetching count:', err);
    }
  };

  if (loading && !turnoActivo && historial.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sección Turno Activo */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" /> Mi Turno Actual
        </h2>
        {turnoActivo ? (
           <div className={`rounded-xl border p-6 ${
             turnoActivo.estados_turno?.codigo === 'atendiendo' 
             ? 'bg-green-50 border-green-200'
             : 'bg-white shadow-sm border-gray-200'
           }`}>
             
             <div className="flex justify-between items-start mb-6">
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                    turnoActivo.estados_turno?.codigo === 'atendiendo'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {turnoActivo.estados_turno?.descripcion}
                  </span>
                  <h3 className="mt-2 text-2xl font-bold text-gray-900">
                    Dr/a. {(turnoActivo.especialistas as any)?.profiles?.nombre} {(turnoActivo.especialistas as any)?.profiles?.apellido}
                  </h3>
                </div>
                {turnoActivo.estados_turno?.codigo === 'en_espera' && pacientesAdelante !== null && (
                  <div className="text-center bg-blue-50 border border-blue-100 rounded-lg p-3 min-w-[120px]">
                    <span className="block text-3xl font-black text-blue-600 leading-none mb-1">
                      {pacientesAdelante}
                    </span>
                    <span className="text-xs text-blue-800 font-medium uppercase tracking-wide">
                      Adelante
                    </span>
                  </div>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  <span>
                    <strong>{(turnoActivo.sedes as any)?.nombre}</strong> - {(turnoActivo.sedes as any)?.direccion}
                  </span>
                </div>
                <div className="flex items-center">
                  <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                  <span>Tu Posición: #{turnoActivo.posicion_fila}</span>
                </div>
             </div>

             {turnoActivo.estados_turno?.codigo === 'atendiendo' && (
                <div className="mt-6 p-4 bg-green-100 rounded-lg border border-green-200 text-green-800 font-medium text-center">
                  Por favor, ingrese al consultorio.
                </div>
             )}
             
             {turnoActivo.estados_turno?.codigo === 'en_espera' && (
                <div className="mt-4 flex justify-end">
                   <button onClick={() => fetchPacientesAdelante(turnoActivo.id)} className="text-xs text-gray-500 hover:text-gray-900 flex items-center">
                     <RefreshCw className="w-3 h-3 mr-1" />
                     Actualizar
                   </button>
                </div>
             )}
           </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-8 text-center">
            <p className="text-gray-500">No tienes ningún turno en espera o en atención el día de hoy.</p>
          </div>
        )}
      </section>

      {/* Sección Historial */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-gray-500" /> Historial de Turnos
        </h2>
        {historial.length > 0 ? (
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {historial.map((turno) => (
                <li key={turno.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Dr/a. {(turno.especialistas as any)?.profiles?.nombre} {(turno.especialistas as any)?.profiles?.apellido}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(turno.sedes as any)?.nombre} • {new Date(turno.fecha_turno).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      turno.estados_turno?.codigo === 'finalizado' ? 'bg-gray-100 text-gray-800' :
                      turno.estados_turno?.codigo === 'cancelado' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {turno.estados_turno?.codigo}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-6">No hay historial de turnos pasados.</p>
        )}
      </section>
    </div>
  );
}
