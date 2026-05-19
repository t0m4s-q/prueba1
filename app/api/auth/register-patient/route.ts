import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { email, password, nombre, apellido, dni, telefono } = await req.json();

    if (!email || !password || !nombre || !apellido || !dni) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    console.log('1. Registrando en auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Error en Auth:', authError);
      throw authError;
    }

    const userId = authData.user.id;
    console.log('User ID creado:', userId);

    // 2. Insertar en Perfiles
    console.log('2. Insertando perfil...');
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      nombre,
      apellido,
      telefono
    });
    if (profileError) {
      console.error('Error en Perfil:', profileError);
      throw profileError;
    }

    // 3. Obtener el ID del rol "paciente" y asignarlo
    console.log('3. Asignando rol...');
    const { data: rolData, error: rolError } = await supabaseAdmin.from('roles').select('id').eq('codigo', 'paciente').single();
    if (rolError) {
        console.error('Error obteniendo rol:', rolError);
    }
    
    if (rolData) {
       const { error: urError } = await supabaseAdmin.from('usuario_roles').insert({
          profile_id: userId,
          rol_id: rolData.id
       });
       if (urError) {
         console.error('Error en usuario_roles:', urError);
       }
    }

    // 4. Insertar en la tabla "pacientes" base obligatoria por ForeignKey
    console.log('4. Insertando paciente...');
    const { error: pacienteError } = await supabaseAdmin.from('pacientes').insert({
      profile_id: userId,
      dni
    });
    if (pacienteError) {
      console.error('Error en pacientes:', pacienteError);
      throw pacienteError;
    }

    console.log('Registro exitoso.');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error en catch general:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
