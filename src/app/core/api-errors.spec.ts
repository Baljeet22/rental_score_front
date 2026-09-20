import { HttpErrorResponse } from '@angular/common/http';
import { apiErrors } from './api-errors';

describe('API feedback', () => {
  it('preserves Django field validation messages', () => {
    expect(apiErrors(new HttpErrorResponse({ status: 400, error: { email: ['A user with this email already exists.'], password: ['Too common.', 'Too short.'] } })))
      .toEqual({ email: 'A user with this email already exists.', password: 'Too common. Too short.' });
  });
  it('does not show server HTML or stack traces', () => {
    expect(apiErrors(new HttpErrorResponse({ status: 500, error: '<html>secret debug information</html>' }))['detail'])
      .toBe('The service is temporarily unavailable. Please try again shortly.');
  });
  it('explains a network failure', () => {
    expect(apiErrors(new HttpErrorResponse({ status: 0 }))['detail']).toContain('could not connect');
  });
});
