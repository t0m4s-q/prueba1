import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { email, password, nombre, apellido, rolCodigo, extraData } = await req.json();

    if (!email || !password || !nombre || !apellido || !rolCodigo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. Insertar Perfil
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      nombre,
      apellido,
    });
    if (profileError) throw profileError;

    // 3. Obtener ID del rol
    const { data: rolData } = await supabaseAdmin.from('roles').select('id').eq('codigo', rolCodigo).single();
    if (rolData) {
       await supabaseAdmin.from('usuario_roles').insert({
          profile_id: userId,
          rol_id: rolData.id
       });
    }

    // 4. Insertar datos adicionales seguros según el rol
    if (rolCodigo === 'especialista') {
      const { matricula, especialidad_id, sedes } = extraData;
      await supabaseAdmin.from('especialistas').insert({
        profile_id: userId,
        matricula,
        especialidad_id
      });
      if (sedes && sedes.length > 0) {
         const rels = sedes.map((sId: number) => ({ especialista_id: userId, sede_id: sId }));
         await supabaseAdmin.from('especialistas_sedes').insert(rels);
      }
    } else if (rolCodigo === 'recepcionista') {
      const { sede_id } = extraData;
      await supabaseAdmin.from('recepcionistas').insert({
        profile_id: userId,
        sede_id
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
