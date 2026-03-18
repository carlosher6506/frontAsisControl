import { TestBed } from '@angular/core/testing';

import { EducationLevelsService } from './education-levels.service';

describe('EducationLevelsService', () => {
  let service: EducationLevelsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EducationLevelsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
