# Plan de Desarrollo y Progreso: Sistema de Gestión de Turnos

Este documento sirve como registro del progreso del desarrollo de la v1.0, dividido en fases funcionales para mantener el enfoque en los requerimientos arquitectónicos y evitar "feature creep".

## Fase 1: Configuración Inicial e Infraestructura [Completada]
- [x] Configurar librerías de UI (Tailwind, componentes base, íconos).
- [x] Configurar cliente de **Supabase** y manejo de variables de entorno (Auth, Realtime, DB).
- [x] Preparar y exportar el **Script SQL Completo** (Esquema, Seeds, Triggers, RLS) para que el desarrollador lo ejecute en Supabase.
- [x] Crear tipos de TypeScript basados en el esquema de la base de datos de Supabase.

## Fase 2: Autenticación y Enrutamiento Base [Completada]
- [x] Construir página de Login (Email / Password).
- [x] Implementar protección de rutas y redirección basada en roles (`admin`, `especialista`, `recepcionista`, `paciente`).
- [x] Crear estructura visual (Layouts) para cada tipo de rol.

## Fase 3: Portal del Paciente [Completada]
- [x] Página de **Turno Activo**: Suscripción en tiempo real a Supabase para ver `posicion_fila` y pacientes adelante.
- [x] Página de **Historial**: Consulta de turnos pasados del paciente logueado (sin observaciones, vía RLS).

## Fase 4: Panel de Recepción [Completada]
- [x] **Registrar paciente en fila**: Buscar/registrar por DNI, elegir sede y especialista, calcular `posicion_fila` inicial, crear turno.
- [x] **Monitor en tiempo real**: Ver la fila interactiva filtrada por Sede.
- [x] **Cancelación de turnos**: Solo en estado `en_espera`, disparando la actualización de las posiciones de la fila.

## Fase 5: Panel del Especialista [Completada]
- [x] **Gestión de Fila**: Vista de turnos `en_espera` ordenados por `posicion_fila`.
- [x] **Acciones de Turno**:
  - Llamar al siguiente paciente (`atendiendo`).
  - Finalizar la consulta (`finalizado`) y registrar `observaciones`.
- [x] **Historial Médico (Simplificado)**: Ver historial del paciente actual con observaciones previas de los turnos.

## Fase 6: Módulo de Notificaciones (Evolution API) [Completada]
- [x] Configurar tabla y trigger de notificaciones (si aplica desde DB) o servicio de backend.
- [x] Implementar llamadas a **Evolution API** para envío de WhatsApp de forma asincrónica.
- [x] Umbrales: Faltan 2, Falta 1, Es tu turno.

---

## Conclusión

El sistema básico v1.0 se ha implementado en su totalidad, respetando el alcance establecido (sin reservas, sin historial complejo, con RLS funcional). Las notificaciones asincrónicas se disparan desde un endpoint de la API Route interna sin bloquear las UI.
- **RLS (Row Level Security)**: Fundamental para datos sensibles (ej. `observaciones`).
- **Estados Válidos**: `en_espera`, `atendiendo`, `finalizado`, `cancelado`.
- **Fuera de Alcance v1**: Reserva por el paciente (agenda futura), Pagos online, HC electrónica completa, App Móvil Nativa.
