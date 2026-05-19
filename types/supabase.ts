export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: number
          codigo: 'admin' | 'especialista' | 'recepcionista' | 'paciente'
          descripcion: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          nombre: string
          apellido: string
          telefono: string | null
          created_at: string
        }
      }
      usuario_roles: {
        Row: {
          profile_id: string
          rol_id: number
        }
        Insert: {
          profile_id: string
          rol_id: number
        }
      }
      sedes: {
        Row: {
          id: number
          nombre: string
          direccion: string | null
          activa: boolean
          created_at: string
        }
      }
      especialidades: {
        Row: {
          id: number
          nombre: string
          descripcion: string | null
        }
      }
      pacientes: {
        Row: {
          profile_id: string
          dni: string
          obra_social: string | null
          nro_afiliado: string | null
        }
      }
      especialistas: {
        Row: {
          profile_id: string
          matricula: string
          especialidad_id: number | null
        }
      }
      recepcionistas: {
        Row: {
          profile_id: string
          sede_id: number
        }
      }
      especialistas_sedes: {
        Row: {
          especialista_id: string
          sede_id: number
        }
      }
      estados_turno: {
        Row: {
          id: number
          codigo: 'en_espera' | 'atendiendo' | 'finalizado' | 'cancelado'
          descripcion: string | null
        }
      }
      turnos: {
        Row: {
          id: string
          paciente_id: string
          especialista_id: string
          sede_id: number
          estado_id: number
          posicion_fila: number | null
          observaciones: string | null
          fecha_turno: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          paciente_id: string
          especialista_id: string
          sede_id: number
          estado_id: number
          posicion_fila?: number | null
          observaciones?: string | null
          fecha_turno?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          paciente_id?: string
          especialista_id?: string
          sede_id?: number
          estado_id?: number
          posicion_fila?: number | null
          observaciones?: string | null
          fecha_turno?: string
          created_at?: string
          updated_at?: string
        }
      }
      tipos_notificacion: {
        Row: {
          id: number
          codigo: string
          descripcion: string | null
          pacientes_adelante: number | null
          template_mensaje: string
        }
      }
      notificaciones: {
        Row: {
          id: string
          turno_id: string
          tipo_id: number
          estado: 'pendiente' | 'enviado' | 'fallido'
          intentos: number
          error_mensaje: string | null
          payload: Json | null
          created_at: string
          sent_at: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          user_uuid: string
          role_code: string
        }
        Returns: boolean
      }
      get_pacientes_adelante: {
        Args: {
          p_turno_id: string
        }
        Returns: number
      }
    }
  }
}
