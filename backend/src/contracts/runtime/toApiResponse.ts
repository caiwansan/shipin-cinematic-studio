export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  meta?: Record<string, any>;
}

export function toApiResponse<T>(
  data: T,
  meta?: Record<string, any>
): ApiResponse<T> {
  return { success: true, data, meta };
}

export function toApiError(
  code: string,
  message: string
): ApiResponse<null> {
  return { success: false, data: null, error: { code, message } };
}
