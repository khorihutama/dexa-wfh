export interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  position: string;
  phone: string;
  photoUrl: string | null;
  role: 'EMPLOYEE' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: EmployeeProfile;
}

export interface EmployeeListResponse {
  data: EmployeeProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface EmployeeFormPayload {
  name: string;
  email: string;
  position: string;
  phone: string;
  password?: string;
  photoUrl?: string;
  photoFile?: File | null;
}

export interface AdminAttendancePair {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    email: string;
    position: string;
    phone: string;
    photoUrl: string | null;
    role: string;
  };
  date: string;
  masuk: string | null;
  pulang: string | null;
  masukTimestamp: string | null;
  pulangTimestamp: string | null;
  status: 'COMPLETE' | 'WORKING';
}

export interface AdminAttendanceResponse {
  filter: {
    from: string;
    to: string;
    employeeId: string | null;
    search: string | null;
    timezone: string;
  };
  data: AdminAttendancePair[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalRecords: number;
  };
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  event?: string;
  employeeName?: string;
}

const envGatewayUrl = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_API_GATEWAY_URL;

export const API_BASE_URL = (envGatewayUrl || `http://${window.location.hostname}:3000`).replace(
  /\/$/,
  '',
);
export const TOKEN_STORAGE_KEY = 'dexa_wfh_admin_token';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function resolvePhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl || !photoUrl.trim()) {
    return null;
  }
  const trimmed = photoUrl.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }
  return `${API_BASE_URL}/${trimmed}`;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    // Network/CORS failure: fetch rejects with a raw "Failed to fetch" TypeError
    throw new ApiError('Gagal terhubung ke server. Periksa koneksi Anda lalu coba lagi.', 0);
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const rawMessage =
      typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message?: string | string[] }).message
        : undefined;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string' && rawMessage.trim()
        ? rawMessage
        : `Permintaan gagal dengan kode HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

function jsonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function loginAdmin(email: string, password: string): Promise<LoginResponse> {
  const response = await safeFetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  return parseApiResponse<LoginResponse>(response);
}

export async function fetchAdminProfile(token: string): Promise<EmployeeProfile> {
  const response = await safeFetch(`${API_BASE_URL}/employees/me`, {
    method: 'GET',
    headers: jsonHeaders(token),
  });
  return parseApiResponse<EmployeeProfile>(response);
}

export async function fetchEmployees(
  token: string,
  search?: string,
): Promise<EmployeeListResponse> {
  const params = new URLSearchParams({ page: '1', limit: '100' });
  if (search && search.trim()) {
    params.set('search', search.trim());
  }
  const response = await safeFetch(`${API_BASE_URL}/employees?${params.toString()}`, {
    method: 'GET',
    headers: jsonHeaders(token),
  });
  return parseApiResponse<EmployeeListResponse>(response);
}

function employeeFormData(payload: EmployeeFormPayload, includePassword: boolean): FormData {
  const formData = new FormData();
  formData.append('name', payload.name.trim());
  formData.append('email', payload.email.trim());
  formData.append('position', payload.position.trim());
  formData.append('phone', payload.phone.trim());
  if (includePassword && payload.password) {
    formData.append('password', payload.password);
  }
  if (payload.photoUrl !== undefined) {
    formData.append('photoUrl', payload.photoUrl.trim());
  }
  if (payload.photoFile) {
    formData.append('photo', payload.photoFile);
  }
  return formData;
}

export async function createEmployee(
  token: string,
  payload: EmployeeFormPayload,
): Promise<EmployeeProfile> {
  const response = await safeFetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: employeeFormData(payload, true),
  });
  return parseApiResponse<EmployeeProfile>(response);
}

export async function updateEmployee(
  token: string,
  id: string,
  payload: EmployeeFormPayload,
): Promise<EmployeeProfile> {
  const response = await safeFetch(`${API_BASE_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: employeeFormData(payload, false),
  });
  return parseApiResponse<EmployeeProfile>(response);
}

export async function deleteEmployee(
  token: string,
  id: string,
): Promise<{ deleted: true; id: string; email: string }> {
  const response = await safeFetch(`${API_BASE_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: jsonHeaders(token),
  });
  return parseApiResponse<{ deleted: true; id: string; email: string }>(response);
}

export async function fetchAttendanceReport(
  token: string,
  params: { from?: string; to?: string; search?: string },
): Promise<AdminAttendanceResponse> {
  const searchParams = new URLSearchParams({ limit: '200' });
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());

  const response = await safeFetch(`${API_BASE_URL}/attendances?${searchParams.toString()}`, {
    method: 'GET',
    headers: jsonHeaders(token),
  });
  return parseApiResponse<AdminAttendanceResponse>(response);
}

export function getJakartaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getJakartaMonthStartString(date: Date = new Date()): string {
  return `${getJakartaDateString(date).slice(0, 7)}-01`;
}

export function formatWibDateTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}
