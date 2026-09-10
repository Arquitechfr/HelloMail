export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Requête invalide'): AppError {
    return new AppError(400, message);
  }

  static unauthorized(message = 'Authentification requise'): AppError {
    return new AppError(401, message);
  }

  static forbidden(message = 'Accès interdit'): AppError {
    return new AppError(403, message);
  }

  static notFound(message = 'Ressource introuvable'): AppError {
    return new AppError(404, message);
  }

  static conflict(message = 'Conflit de ressource'): AppError {
    return new AppError(409, message);
  }

  static unprocessable(message = 'Données non traitables'): AppError {
    return new AppError(422, message);
  }

  static tooManyRequests(message = 'Trop de tentatives, réessayez dans quelques minutes'): AppError {
    return new AppError(429, message);
  }
}
