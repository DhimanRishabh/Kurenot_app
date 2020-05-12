import { TestBed } from '@angular/core/testing';

import { WebrtcserviceService } from './webrtcservice.service';

describe('WebrtcserviceService', () => {
  let service: WebrtcserviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebrtcserviceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
