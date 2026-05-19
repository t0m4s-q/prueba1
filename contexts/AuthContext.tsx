'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type RoleCode = 'admin' | 'especialista' | 'recepcionista' | 'paciente';

export interface UserRole {
  codigo: RoleCode;
  descripcion: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  currentRole: RoleCode | null;
  setCurrentRole: (role: RoleCode) => void;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [currentRole, setCurrentRole] = useState<RoleCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Obtain initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRoles(session.user.id);
        } else {
          setRoles([]);
          setCurrentRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuario_roles')
        .select(`
          roles (
            codigo,
            descripcion
          )
        `)
        .eq('profile_id', userId);

      if (error) throw error;

      if (data) {
        const userRoles = data
          .map((ur: any) => ur.roles)
          .filter(Boolean) as UserRole[];
        
        setRoles(userRoles);
        
        // If only one role, auto-select it. Otherwise wait for user to select (handled in UI)
        if (userRoles.length === 1) {
          setCurrentRole(userRoles[0].codigo);
        } else {
            setCurrentRole(null);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setCurrentRole(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        currentRole,
        setCurrentRole,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
