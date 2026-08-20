import { EstadoAsistencia } from '../models/attendance.model';

export interface OpcionEstadoAsistencia{
  value: EstadoAsistencia;
  label:string;
  icon:string;
  colorClass:string;
}

export const ESTADOS_ASISTENCIA : OpcionEstadoAsistencia[] = [
  { value: 'presente',      label: 'Presente',     icon: 'bi-check-circle-fill',        colorClass: 'estado-presente' },
  { value: 'retardo',       label: 'Retardo',      icon: 'bi-clock-fill',               colorClass: 'estado-retardo' },
  { value: 'justificado',   label: 'Justificado',  icon: 'bi-file-earmark-check-fill',  colorClass: 'estado-justificado' },
  { value: 'ausente',       label: 'Ausente',      icon: 'bi-x-circle-fill',            colorClass: 'estado-ausente' }
];

export const ESTADOS_ASISTENCIA_DEFAULT : EstadoAsistencia = 'ausente';
