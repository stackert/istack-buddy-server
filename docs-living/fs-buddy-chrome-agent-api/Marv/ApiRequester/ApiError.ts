class ApiError extends Error {
  #_extraData: object;
  constructor(message: string, extraData?: object) {
    super(message);
    this.#_extraData = extraData || {};
  }

  get name(): string {
    return "ApiError";
  }

  get code(): string {
    return "API_ERROR";
  }

  get extraData(): object {
    return { ...this.#_extraData };
  }
}

export { ApiError };
