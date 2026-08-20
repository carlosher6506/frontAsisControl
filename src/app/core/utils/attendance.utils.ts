import { EstadoAsistencia } from '../models/attendance.model';
import { ESTADOS_ASISTENCIA, ESTADOS_ASISTENCIA_DEFAULT, OpcionEstadoAsistencia } from '../constants/attendance.constants';

export function obtenerConfigEstado(estado : EstadoAsistencia | null): OpcionEstadoAsistencia | null{
  if (!estado) {
    return null;
  }
  return ESTADOS_ASISTENCIA.find(e=> e.value === estado) ?? null;
}

export function obtenerClaseAsistencia(porcentaje: number): 'asistencia-alta' | 'asistencia-media' | 'asistencia-baja' {
  if (porcentaje >= 90) return 'asistencia-alta';
  if (porcentaje >= 75) return 'asistencia-media';
  return 'asistencia-baja';
}

export function calcularResumenAsistencia(estados: (EstadoAsistencia | null)[]): Record<EstadoAsistencia | 'sinMarcar', number>{
  const resumen: Record<EstadoAsistencia | 'sinMarcar', number> = {
    presente: 0,
    ausente: 0,
    retardo: 0,
    justificado: 0,
    sinMarcar: 0
  };
  for (const estado of estados){
    if (estado === null){
      resumen.sinMarcar ++;
    }else{
      resumen[estado]++;
    }
  }
  return resumen;
}
