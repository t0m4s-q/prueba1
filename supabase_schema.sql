-- ==========================================
-- SISTEMA DE GESTIÓN DE TURNOS V1.0
-- SCRIPT DE INICIALIZACIÓN - SUPABASE
-- ==========================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. AUTENTICACIÓN Y ROLES
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL, -- 'admin', 'especialista', 'recepcionista', 'paciente'
    descripcion TEXT
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usuario_roles (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rol_id INT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, rol_id)
);

-- Seeds de roles
INSERT INTO roles (codigo, descripcion) VALUES
('admin', 'Administrador General del Sistema'),
('especialista', 'Médico Especialista'),
('recepcionista', 'Personal de Recepción de Sede'),
('paciente', 'Paciente de la Clínica')
ON CONFLICT (codigo) DO NOTHING;


-- 3. TABLAS MAESTRAS
CREATE TABLE sedes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    direccion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE especialidades (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT
);


-- 4. ENTIDADES POR ROL
CREATE TABLE pacientes (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    dni TEXT UNIQUE NOT NULL,
    obra_social TEXT,
    nro_afiliado TEXT
);

CREATE TABLE especialistas (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    matricula TEXT UNIQUE NOT NULL,
    especialidad_id INT REFERENCES especialidades(id) ON DELETE RESTRICT
);

CREATE TABLE recepcionistas (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    sede_id INT REFERENCES sedes(id) ON DELETE RESTRICT
);

CREATE TABLE especialistas_sedes (
    especialista_id UUID REFERENCES especialistas(profile_id) ON DELETE CASCADE,
    sede_id INT REFERENCES sedes(id) ON DELETE CASCADE,
    PRIMARY KEY (especialista_id, sede_id)
);


-- 5. TURNOS
CREATE TABLE estados_turno (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descripcion TEXT
);

-- Seeds
INSERT INTO estados_turno (codigo, descripcion) VALUES
('en_espera',  'Paciente aguardando en la sala de espera'),
('atendiendo', 'Paciente actualmente en el consultorio'),
('finalizado', 'Consulta médica concluida'),
('cancelado',  'Turno anulado')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id    UUID REFERENCES pacientes(profile_id)    ON DELETE RESTRICT,
    especialista_id UUID REFERENCES especialistas(profile_id) ON DELETE RESTRICT,
    sede_id        INT  REFERENCES sedes(id)                ON DELETE RESTRICT,
    estado_id      INT  REFERENCES estados_turno(id)        ON DELETE RESTRICT,
    posicion_fila  INT,
    observaciones  TEXT,
    fecha_turno    DATE DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_turnos_fila ON turnos(especialista_id, sede_id, estado_id, posicion_fila);


-- 6. NOTIFICACIONES
CREATE TABLE tipos_notificacion (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    pacientes_adelante INT,
    template_mensaje TEXT NOT NULL
);

-- Seeds
INSERT INTO tipos_notificacion (codigo, descripcion, pacientes_adelante, template_mensaje) VALUES
('falta_2', 'Aviso: Faltan 2 personas', 2, 'Hola {{nombre}}, faltan 2 personas para su atención en {{sede}} con el Dr/a {{especialista}}. Por favor, permanezca cerca.'),
('falta_1', 'Aviso: Falta 1 persona', 1, 'Hola {{nombre}}, falta solo 1 persona para su atención. Por favor, acérquese a la sala de espera principal.'),
('tu_turno', 'Aviso: Es su turno', 0, '¡{{nombre}}, es su turno! Por favor ingrese al consultorio del Dr/a {{especialista}}.')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turno_id   UUID REFERENCES turnos(id)             ON DELETE CASCADE,
    tipo_id    INT  REFERENCES tipos_notificacion(id) ON DELETE RESTRICT,
    estado     TEXT DEFAULT 'pendiente', -- 'pendiente', 'enviado', 'fallido'
    intentos   INT DEFAULT 0,
    error_mensaje TEXT,
    payload    JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at    TIMESTAMPTZ,
    UNIQUE (turno_id, tipo_id) -- Regla: Una notificación por tipo por turno
);


-- ==========================================
-- 7. FUNCIONES Y TRIGGERS DE NEGOCIO
-- ==========================================

-- Función para recalcular fila tras cancelación / cierre
CREATE OR REPLACE FUNCTION recalcular_fila()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado_id = (SELECT id FROM estados_turno WHERE codigo = 'en_espera') AND
        NEW.estado_id IN (SELECT id FROM estados_turno WHERE codigo IN ('cancelado', 'atendiendo'))) THEN
        
        UPDATE turnos
        SET posicion_fila = sub.nueva_posicion, updated_at = NOW()
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (ORDER BY posicion_fila ASC) AS nueva_posicion
          FROM turnos t
          WHERE t.especialista_id = OLD.especialista_id
            AND t.sede_id = OLD.sede_id
            AND t.fecha_turno = OLD.fecha_turno
            AND t.estado_id = (SELECT id FROM estados_turno WHERE codigo = 'en_espera')
        ) sub
        WHERE turnos.id = sub.id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalcular_fila
AFTER UPDATE ON turnos
FOR EACH ROW
EXECUTE FUNCTION recalcular_fila();

-- Función para obtener pacientes adelante (Security Definer para bypassear RLS del paciente)
CREATE OR REPLACE FUNCTION get_pacientes_adelante(p_turno_id UUID)
RETURNS INT AS $$
DECLARE
  v_especialista_id UUID;
  v_sede_id INT;
  v_posicion_fila INT;
  v_fecha_turno DATE;
  v_count INT;
BEGIN
  SELECT especialista_id, sede_id, posicion_fila, fecha_turno
  INTO v_especialista_id, v_sede_id, v_posicion_fila, v_fecha_turno
  FROM turnos
  WHERE id = p_turno_id;

  SELECT COUNT(*)
  INTO v_count
  FROM turnos t
  JOIN estados_turno e ON e.id = t.estado_id
  WHERE t.especialista_id = v_especialista_id
    AND t.sede_id = v_sede_id
    AND t.fecha_turno = v_fecha_turno
    AND e.codigo = 'en_espera'
    AND t.posicion_fila < v_posicion_fila;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 8. RLS (ROW LEVEL SECURITY)
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE especialistas ENABLE ROW LEVEL SECURITY;

-- Helpers para RLS
CREATE OR REPLACE FUNCTION has_role(user_uuid UUID, role_code TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_roles ur
    JOIN roles r ON r.id = ur.rol_id
    WHERE ur.profile_id = user_uuid AND r.codigo = role_code
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: Admin todo, el resto solo puede ver/editar su propio perfil (salvo admins)
CREATE POLICY "Perfiles - Todos ven sus propios datos" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Perfiles - Admin ven todos" ON profiles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Roles
CREATE POLICY "Roles son públicos" ON roles FOR SELECT USING (true);
CREATE POLICY "Asignaciones de roles publicos" ON usuario_roles FOR SELECT USING (true);

-- Turnos
-- Administrador: All
CREATE POLICY "Turnos - Admin Todo" ON turnos FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Paciente: Solo ver sus propios turnos (lectura)
CREATE POLICY "Turnos - Paciente Lectura" ON turnos FOR SELECT USING (paciente_id = auth.uid());

-- Recepcionistas: Pueden crear y ver turnos de su sede (simplificamos leyendo si tienen sede asignada)
-- Por simplicidad (no join profundo en RLS), si es recepcionista puede operar sobre turnos.
CREATE POLICY "Turnos - Recepcionista Crear/Update" ON turnos FOR ALL USING (has_role(auth.uid(), 'recepcionista'));

-- Especialista: Puede editar y ver sus propios turnos
CREATE POLICY "Turnos - Especialista All" ON turnos FOR ALL USING (especialista_id = auth.uid());

-- Notificaciones
CREATE POLICY "Notifs - Admin" ON notificaciones FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Notifs - Solo backend (insertar trigger)" ON notificaciones FOR INSERT WITH CHECK (true);
