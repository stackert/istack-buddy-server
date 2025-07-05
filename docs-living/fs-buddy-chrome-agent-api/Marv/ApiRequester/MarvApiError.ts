import { ApiError } from "./ApiError";

class MarvApiError extends ApiError {
  get name(): string {
    return "MarvApiError";
  }

  get code(): string {
    return "MARV_API_ERROR";
  }
  toJson() {
    return {
      message: this.message,
      extraData: this.extraData,
      name: this.name,
      code: this.code,
    };
  }
}
export { MarvApiError };
