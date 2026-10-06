export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new HttpError(400, message)
export const forbidden = (message = 'Você não tem permissão para fazer isso.') => new HttpError(403, message)
export const notFound = (message = 'Não encontrado.') => new HttpError(404, message)
