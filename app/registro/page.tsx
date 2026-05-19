'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegistroPacientePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el paciente');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Registro completado!</h2>
          <p className="text-gray-600">Tu cuenta de paciente se ha creado exitosamente. Ya puedes iniciar sesión.</p>
          <p className="text-sm text-gray-400 mt-4">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <UserPlus className="mx-auto h-10 w-10 text-blue-600" />
        <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Registro de Paciente
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Complete sus datos para acceder al portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100 relative">
          
          <Link href="/" className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <form className="space-y-5 mt-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  required
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido</label>
                <input
                  required
                  type="text"
                  value={formData.apellido}
                  onChange={e => setFormData({...formData, apellido: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">DNI</label>
              <input
                required
                type="text"
                value={formData.dni}
                onChange={e => setFormData({...formData, dni: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Sin puntos, ej: 35123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono (WhatsApp)</label>
              <input
                required
                type="text"
                value={formData.telefono}
                onChange={e => setFormData({...formData, telefono: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Ej: 5491112345678"
              />
              <p className="text-xs text-gray-500 mt-1">Necesario para recibir notificaciones de su turno.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                required
                type="password"
                minLength={6}
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5 text-white" /> : 'Crear Cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
