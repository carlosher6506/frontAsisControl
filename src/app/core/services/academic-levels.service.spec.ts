import { TestBed } from '@angular/core/testing';

import { AcademicLevelsService } from './academic-levels.service';

describe('AcademicLevelsService', () => {
  let service: AcademicLevelsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AcademicLevelsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
