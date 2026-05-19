'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, roles, currentRole, setCurrentRole, isLoading, signOut } = useAuth();

  // Handle redirection based on role
  useEffect(() => {
    if (!isLoading && user && currentRole) {
      switch (currentRole) {
        case 'recepcionista':
          router.push('/recepcion');
          break;
        case 'especialista':
          router.push('/especialista');
          break;
        case 'paciente':
          router.push('/paciente');
          break;
        case 'admin':
          router.push('/admin');
          break;
        default:
          break;
      }
    }
  }, [user, currentRole, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  // Si ya tiene usuario, pero múltiples roles y no seleccionó ninguno
  if (user && roles.length > 1 && !currentRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Stethoscope className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Seleccione su Rol
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Su cuenta tiene múltiples perfiles asociados
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100 flex flex-col space-y-4">
            {roles.map((role) => (
              <button
                key={role.codigo}
                onClick={() => setCurrentRole(role.codigo)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <div className="flex flex-col text-left">
                  <span className="capitalize">{role.codigo}</span>
                  <span className="text-xs text-gray-500 font-normal">{role.descripcion}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}

            <button
               onClick={signOut}
               className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si ya está logueado y tiene rol (o no tiene roles asignados aun) pero useEffect aun no redirigió
  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600 mb-4" />
          <p className="text-gray-600 text-center">
              {roles.length === 0 ? "No tienes roles asignados. Contacta al administrador." : "Redirigiendo..."}
          </p>
          {roles.length === 0 && (
              <button onClick={signOut} className="mt-4 text-blue-600 underline">Cerrar Sesión</button>
          )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Stethoscope className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Gestión de Turnos Clínicos
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Inicie sesión para acceder a su panel
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  placeholder="ejemplo@clinica.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-100">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error de Autenticación</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Ingresar al Sistema'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Es su primera vez en la clínica?{' '}
              <a href="/registro" className="font-medium text-blue-600 hover:text-blue-500">
                Regístrese aquí
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
