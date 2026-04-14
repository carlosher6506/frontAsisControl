import { TestBed } from '@angular/core/testing';

import { GrupoMateriasService } from './grupo-materias.service';

describe('GrupoMateriasService', () => {
  let service: GrupoMateriasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GrupoMateriasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
