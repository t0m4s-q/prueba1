'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  const { user, currentRole, isLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || currentRole !== 'paciente')) {
      router.push('/');
    }
  }, [user, currentRole, isLoading, router]);

  if (isLoading || !user || currentRole !== 'paciente') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-2">
              <UserIcon className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Portal del Paciente</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={signOut}
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
