import { Component } from '@angular/core';

@Component({
  selector: 'app-roll-call',
  imports: [],
  templateUrl: './roll-call.component.html',
  styleUrl: './roll-call.component.scss',
})
export class RollCallComponent {}


/* agregar paginacion a 15 grupos, reemplazar la forma de ver los grupos de tablas a tarjetas,
   agregar funcionalidad de filtro tradicional mediante niveles educativos
   la informacion que los cards deben de mostrar son: grado, grupo y nombre del maestro (esto es la vista de las tarjetas)
   informacion interna de los cards que deben de mostrar son: nombre de los alumnos y matricula
   acciones internas de los cards: agregar y eliminar alumno del grupo, editar cards (informacion de esta misma) eliminar grupo
   si se elimina el grupo no se deben de eliminar los alumnos asociados solo desasignarse el grupo al alumno
   Agregar un boton a la vista del card interno para pase de lista de los alumnos de ese grupo (solo el boton nada de funcionalidad)
*/
