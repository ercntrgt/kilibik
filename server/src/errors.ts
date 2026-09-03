export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message ?? code);
  }
}

export const err = {
  badRequest: (code: string, msg?: string, extra?: Record<string, unknown>) => new HttpError(400, code, msg, extra),
  unauthorized: (code = 'unauthorized') => new HttpError(401, code),
  forbidden: (code = 'forbidden', msg?: string) => new HttpError(403, code, msg),
  notFound: (code = 'not_found') => new HttpError(404, code),
  conflict: (code: string, msg?: string) => new HttpError(409, code, msg),
  tooMany: (code: string, retryAfter: number) => new HttpError(429, code, undefined, { retry_after: retryAfter }),
};
