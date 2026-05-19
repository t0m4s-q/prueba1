'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, currentRole, isLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || currentRole !== 'admin')) {
      router.push('/');
    }
  }, [user, currentRole, isLoading, router]);

  if (isLoading || !user || currentRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex gap-2 items-center">
              <Settings className="h-5 w-5 text-gray-300" />
              <h1 className="text-xl font-bold tracking-tight">Administración</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">{user.email}</span>
              <button
                onClick={signOut}
                className="inline-flex items-center text-sm text-gray-300 hover:text-white"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
