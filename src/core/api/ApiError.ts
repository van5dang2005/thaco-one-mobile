/**
 * Back-ends this app has screens for. Adding one starts here: the compiler then asks for its client
 * (`clients.ts`) and the apps-portal code that grants it (`serviceAppCodes`); its home tiles go in `nativeModules`.
 */
export type ServiceId = 'parcel' | 'room';

/**
 * Every back-end `createApiClient` talks to: the services above, plus ones that only answer a feature's own calls
 * (no users/me, notifications or hub there), so they stay out of `ServiceId` and the per-service loops.
 */
export type ApiService = ServiceId | 'guest' | 'document';

type ApiErrorInit = {
  service: ApiService;
  status: number;
  errorCode: string;
  message: string;
  details?: unknown;
};

/**
 * Normalised back-end failure. `status` is 0 for network failures. `errorCode` always comes from
 * the server body (`errorCode`) when present, otherwise a synthetic code (NETWORK, TIMEOUT, HTTP_404…).
 */
export class ApiError extends Error {
  readonly service: ApiService;
  readonly status: number;
  readonly errorCode: string;
  readonly details?: unknown;

  constructor({ service, status, errorCode, message, details }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.service = service;
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }

  get isNetwork() {
    return this.status === 0;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
