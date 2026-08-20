export type EstadoAsistencia = 'presente' | 'ausente' | 'retardo' | 'justificado';
export type MetodoAsistencia = 'manual' | 'qr';

export interface MateriaGrupo {
  grupo_materia_id: number;
  materia_id: number;
  materia_nombre: string;
}

export interface SesionAsistencia {
  id: number;
  grupo_materia_id: number;
  maestro_id: number;
  fecha: string;
  metodo_default: MetodoAsistencia;
  cerrada: boolean;
}

export interface AlumnoListaAsistencia {
  alumno_id: number;
  alumno_nombre: string;
  matricula: string;
  registro_id: number | null;
  estado: EstadoAsistencia | null;
  metodo: MetodoAsistencia | null;
  hora_registro: string | null;
}

export interface ListaAsistenciaResponse {
  sesion: SesionAsistencia;
  alumnos: AlumnoListaAsistencia[];
}

export interface AbrirSesionRequest {
  grupo_materia_id: number;
  fecha?: string;
  metodo_default?: MetodoAsistencia;
}

export interface RegistrarAsistenciaManual {
  sesion_id: number;
  alumno_id: number;
  estado: EstadoAsistencia;
  justificacion?: string;
}

export interface RegistrarAsistenciaQr {
  sesion_id: number;
  token: string;
}

export interface ResultadoRegistroQr {
  alumno_id: number;
  alumno_nombre: string;
  estado: EstadoAsistencia;
  ya_estaba_registrado: boolean;
}

export interface ReporteAsistenciaAlumno {
  alumno_id: number;
  alumno_nombre: string;
  matricula: string;
  total_sesiones: number;
  presentes: number;
  ausentes: number;
  retardos: number;
  justificados: number;
  porcentaje_asistencia: number;
}

export interface CredencialQr {
  token: string;
  activo: boolean;
  created_at?: string;
  regenerated_at?: string;
}
