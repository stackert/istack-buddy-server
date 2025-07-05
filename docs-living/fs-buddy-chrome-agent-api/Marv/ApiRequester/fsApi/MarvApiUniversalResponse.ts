export interface IMarvApiUniversalResponse<T> {
  /**
   * if status is "success" read from response, error null.
   * if status is "success" read from response, error null.
   */
  isSuccess: boolean;
  response: T | null;
  errorItems: any[] | null;
}

class MarvApiUniversalResponse<T> implements IMarvApiUniversalResponse<T> {
  #status: "error" | "success";
  #response: T | null = null;
  #errorItems: any[] | null = null;
  constructor(status: "error" | "success", response?: T, error?: any) {
    this.#status = status;

    if (response) {
      this.#response = response;
    }

    if (error) {
      this.#errorItems = [error];
    }
  }

  get status(): "error" | "success" {
    return this.#status;
  }

  get response(): T | null {
    return this.#response;
  }

  get errorItems(): any[] | null {
    // do we want deepClone here?, is that doable on browsers
    return this.#errorItems;
  }

  get isSuccess(): boolean {
    return this.#status === "success";
  }

  pushError(error: any): void {
    if (!this.#errorItems) {
      this.#errorItems = [];
    }
    this.#errorItems.push(error);
  }
}
export { MarvApiUniversalResponse };
