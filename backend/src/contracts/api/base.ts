export type ID = string;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectNarrative {
  title: string;
  genre: string;
  logline: string;
  synopsis?: string;
}
