import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // fallback if service_role not set
);

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

export async function POST(req: Request) {
  try {
    const { especialista_id, sede_id } = await req.json();

    if (!especialista_id || !sede_id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Obtener la fila en espera ordenada por posicion
    const { data: turnos, error: turnosError } = await supabaseAdmin
      .from('turnos')
      .select(`
        id, posicion_fila, 
        pacientes(dni, telefono, profiles(nombre, apellido)),
        especialistas(profiles(nombre, apellido)),
        sedes(nombre)
      `)
      .eq('especialista_id', especialista_id)
      .eq('sede_id', sede_id)
      .eq('fecha_turno', today)
      .eq('estado_id', (await supabaseAdmin.from('estados_turno').select('id').eq('codigo', 'en_espera').single()).data?.id)
      .order('posicion_fila', { ascending: true });

    if (turnosError) throw turnosError;

    // 2. Traer tipos de notificacion
    const { data: tipos } = await supabaseAdmin.from('tipos_notificacion').select('*');
    if (!tipos || tipos.length === 0) return NextResponse.json({ status: 'No notification types configured' });

    // 3. Procesar fila
    let pacientesAdelante = 0;
    
    for (const turno of turnos || []) {
       // Buscar si hay regla para este nro de pacientes adelante
       const tipo = tipos.find(t => t.pacientes_adelante === pacientesAdelante);
       
       if (tipo) {
          // Verificar si ya se envió esta notificación
          const { data: exists } = await supabaseAdmin
            .from('notificaciones')
            .select('id, estado')
            .eq('turno_id', turno.id)
            .eq('tipo_id', tipo.id)
            .single();
            
          if (!exists || exists.estado === 'fallido') {
             // Crear la notificacion
             
             // Preparar mensaje
             let msj = tipo.template_mensaje;
             const nombrePaciente = (turno.pacientes as any)?.profiles?.nombre || 'Paciente';
             const nombreSede = (turno.sedes as any)?.nombre || 'la clínica';
             const nombreEsp = (turno.especialistas as any)?.profiles?.apellido || 'Especialista';
             
             msj = msj.replace('{{nombre}}', nombrePaciente);
             msj = msj.replace('{{sede}}', nombreSede);
             msj = msj.replace('{{especialista}}', nombreEsp);
             const telefono = (turno.pacientes as any)?.telefono || '5491111111111'; // Mock fallback
             
             // Insertar / Update notificación
             let notifId = exists?.id;
             if (!notifId) {
                const { data: inserted, error: insertErr } = await supabaseAdmin
                  .from('notificaciones')
                  .insert({
                     turno_id: turno.id,
                     tipo_id: tipo.id,
                     estado: 'pendiente'
                  })
                  .select('id').single();
                  
                if (!insertErr && inserted) notifId = inserted.id;
             }

             if (notifId) {
               // Llamar a Evolution API asíncronamente
               if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE) {
                 try {
                   const r = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
                     method: 'POST',
                     headers: {
                       'Content-Type': 'application/json',
                       'apikey': EVOLUTION_API_KEY
                     },
                     body: JSON.stringify({
                       number: telefono,
                       text: msj
                     })
                   });
                   
                   if (r.ok) {
                     await supabaseAdmin.from('notificaciones').update({ estado: 'enviado', sent_at: new Date().toISOString() }).eq('id', notifId);
                   } else {
                     const errText = await r.text();
                     await supabaseAdmin.from('notificaciones').update({ estado: 'fallido', error_mensaje: errText }).eq('id', notifId);
                   }
                 } catch (apiErr: any) {
                   await supabaseAdmin.from('notificaciones').update({ estado: 'fallido', error_mensaje: apiErr.message }).eq('id', notifId);
                 }
               } else {
                 // Mock send
                 console.log(`[Mock WhatsApp to ${telefono}]: ${msj}`);
                 await supabaseAdmin.from('notificaciones').update({ estado: 'enviado', sent_at: new Date().toISOString() }).eq('id', notifId);
               }
             }
          }
       }
       
       pacientesAdelante++;
    }

    return NextResponse.json({ success: true, count: turnos?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
