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

export interface UpdateMyProfilePayload {
  phone?: string;
  photoUrl?: string;
  photoFile?: File | null;
  currentPassword?: string;
  newPassword?: string;
}

export interface UpdateMyProfileResponse extends EmployeeProfile {
  changedFields: string[];
  notificationDispatched: boolean;
}

export interface FormattedAttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: 'MASUK' | 'PULANG';
  timestamp: string;
  formattedTime: string;
}

export interface TodayAttendanceStatus {
  date: string;
  timezone: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  masuk: string | null;
  pulang: string | null;
  masukTimestamp: string | null;
  pulangTimestamp: string | null;
  records: FormattedAttendanceRecord[];
}

export interface AttendanceActionResponse {
  message: string;
  record: FormattedAttendanceRecord;
  todayStatus: TodayAttendanceStatus;
}

export interface DailyAttendanceSummaryItem {
  date: string;
  masuk: string | null;
  pulang: string | null;
  masukTimestamp: string | null;
  pulangTimestamp: string | null;
  status: 'COMPLETE' | 'WORKING';
}

export interface MyAttendanceSummaryResponse {
  employeeId: string;
  filter: {
    from: string;
    to: string;
    timezone: string;
  };
  todayStatus: TodayAttendanceStatus;
  summary: DailyAttendanceSummaryItem[];
  data: DailyAttendanceSummaryItem[];
  records: FormattedAttendanceRecord[];
}

const envGatewayUrl = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_API_GATEWAY_URL;

export const API_BASE_URL = (envGatewayUrl || `http://${window.location.hostname}:3000`).replace(
  /\/$/,
  '',
);

export const TOKEN_STORAGE_KEY = 'dexa_wfh_employee_token';

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

export async function loginEmployee(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await safeFetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  return parseApiResponse<LoginResponse>(response);
}

export async function fetchMyProfile(token: string): Promise<EmployeeProfile> {
  const response = await safeFetch(`${API_BASE_URL}/employees/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<EmployeeProfile>(response);
}

export async function updateMyProfile(
  token: string,
  payload: UpdateMyProfilePayload,
): Promise<UpdateMyProfileResponse> {
  if (payload.photoFile) {
    const formData = new FormData();
    formData.append('photo', payload.photoFile);
    if (payload.phone !== undefined) {
      formData.append('phone', payload.phone.trim());
    }
    if (payload.currentPassword) {
      formData.append('currentPassword', payload.currentPassword);
    }
    if (payload.newPassword) {
      formData.append('newPassword', payload.newPassword);
    }

    const response = await safeFetch(`${API_BASE_URL}/employees/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return parseApiResponse<UpdateMyProfileResponse>(response);
  }

  const jsonBody: Record<string, string> = {};
  if (payload.phone !== undefined) {
    jsonBody.phone = payload.phone.trim();
  }
  if (payload.photoUrl !== undefined) {
    jsonBody.photoUrl = payload.photoUrl.trim();
  }
  if (payload.currentPassword) {
    jsonBody.currentPassword = payload.currentPassword;
  }
  if (payload.newPassword) {
    jsonBody.newPassword = payload.newPassword;
  }

  const response = await safeFetch(`${API_BASE_URL}/employees/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonBody),
  });

  return parseApiResponse<UpdateMyProfileResponse>(response);
}

export async function uploadMyPhoto(
  token: string,
  file: File,
): Promise<UpdateMyProfileResponse> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await safeFetch(`${API_BASE_URL}/employees/me/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return parseApiResponse<UpdateMyProfileResponse>(response);
}

export async function fetchTodayAttendance(
  token: string,
): Promise<TodayAttendanceStatus> {
  const response = await safeFetch(`${API_BASE_URL}/attendances/today`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<TodayAttendanceStatus>(response);
}

export async function checkInAttendance(
  token: string,
): Promise<AttendanceActionResponse> {
  const response = await safeFetch(`${API_BASE_URL}/attendances/check-in`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'MASUK' }),
  });

  return parseApiResponse<AttendanceActionResponse>(response);
}

export async function checkOutAttendance(
  token: string,
): Promise<AttendanceActionResponse> {
  const response = await safeFetch(`${API_BASE_URL}/attendances/check-out`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'PULANG' }),
  });

  return parseApiResponse<AttendanceActionResponse>(response);
}

export async function fetchMyAttendanceSummary(
  token: string,
  params?: { from?: string; to?: string },
): Promise<MyAttendanceSummaryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.from) {
    searchParams.set('from', params.from);
  }
  if (params?.to) {
    searchParams.set('to', params.to);
  }
  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/attendances/me${queryString ? `?${queryString}` : ''}`;

  const response = await safeFetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<MyAttendanceSummaryResponse>(response);
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
  const today = getJakartaDateString(date);
  return `${today.slice(0, 7)}-01`;
}

export function formatWibClock(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ':');
}

export function formatWibLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
