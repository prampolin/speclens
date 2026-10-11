export class PrivacyViolationError extends Error {
  constructor(message: string) {
    super(`[PrivacyViolation] ${message}`);
    this.name = 'PrivacyViolationError';
    Object.setPrototypeOf(this, PrivacyViolationError.prototype);
  }
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(`[ModelUnavailable] ${message}`);
    this.name = 'ModelUnavailableError';
    Object.setPrototypeOf(this, ModelUnavailableError.prototype);
  }
}
