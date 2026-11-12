import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Spinner } from '@dexa-wfh/ui';
import {
  AdminAttendancePair,
  AdminNotification,
  API_BASE_URL,
  ApiError,
  clearStoredToken,
  createEmployee,
  deleteEmployee,
  EmployeeFormPayload,
  EmployeeProfile,
  fetchAdminProfile,
  fetchAttendanceReport,
  fetchEmployees,
  getJakartaDateString,
  getJakartaMonthStartString,
  getStoredToken,
  loginAdmin,
  setStoredToken,
  updateEmployee,
} from './api';
import { AdminLayout, type AdminMenuTab } from './components/AdminLayout';
import { AttendanceMonitor } from './components/AttendanceMonitor';
import { EmployeeManager } from './components/EmployeeManager';
import { LoginView } from './components/LoginView';
import { NotificationToasts } from './components/NotificationToasts';

const TOAST_DURATION_MS = 9000;
const MAX_TOASTS = 4;

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [admin, setAdmin] = useState<EmployeeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AdminMenuTab>('employees');
  const [authLoading, setAuthLoading] = useState<boolean>(() => Boolean(getStoredToken()));
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [attendanceRows, setAttendanceRows] = useState<AdminAttendancePair[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState<string>(() => getJakartaMonthStartString());
  const [filterTo, setFilterTo] = useState<string>(() => getJakartaDateString());
  const [filterSearch, setFilterSearch] = useState('');

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const handleLogout = useCallback(() => {
    clearStoredToken();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setToken(null);
    setAdmin(null);
    setEmployees([]);
    setAttendanceRows([]);
    setNotifications([]);
    setSuccessMessage(null);
    setAuthError(null);
    setSocketConnected(false);
  }, []);

  const loadEmployees = useCallback(
    async (activeToken: string, search: string) => {
      setEmployeesLoading(true);
      setEmployeesError(null);
      try {
        const result = await fetchEmployees(activeToken, search);
        setEmployees(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleLogout();
          return;
        }
        setEmployeesError(
          err instanceof Error ? err.message : 'Tidak dapat memuat data karyawan.',
        );
      } finally {
        setEmployeesLoading(false);
      }
    },
    [handleLogout],
  );

  const loadAttendance = useCallback(
    async (activeToken: string, filter: { from: string; to: string; search: string }) => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const result = await fetchAttendanceReport(activeToken, filter);
        setAttendanceRows(result.data ?? []);
        setFilterFrom(result.filter.from);
        setFilterTo(result.filter.to);
        setFilterSearch(result.filter.search ?? '');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleLogout();
          return;
        }
        setAttendanceError(
          err instanceof Error ? err.message : 'Tidak dapat memuat rekap absensi.',
        );
      } finally {
        setAttendanceLoading(false);
      }
    },
    [handleLogout],
  );

  const bootstrapSession = useCallback(
    async (activeToken: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const profile = await fetchAdminProfile(activeToken);
        if (profile.role !== 'ADMIN') {
          clearStoredToken();
          setToken(null);
          setAdmin(null);
          setAuthError('Akun ini bukan Admin HRD. Gunakan akun dengan peran ADMIN.');
          return;
        }
        setAdmin(profile);
        await Promise.all([
          loadEmployees(activeToken, ''),
          loadAttendance(activeToken, {
            from: getJakartaMonthStartString(),
            to: getJakartaDateString(),
            search: '',
          }),
        ]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearStoredToken();
          setToken(null);
          setAdmin(null);
          setAuthError('Sesi login Anda telah berakhir. Silakan masuk kembali.');
        } else {
          setAuthError(
            err instanceof Error ? err.message : 'Gagal menghubungi server API Gateway.',
          );
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [loadAttendance, loadEmployees],
  );

  useEffect(() => {
    if (token && !admin) {
      void bootstrapSession(token);
    }
  }, [token, admin, bootstrapSession]);

  useEffect(() => {
    if (!admin || !token) return;
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('admin.notification', (payload: AdminNotification) => {
      // Gateway emits a channel handshake toast on connect; only business events matter here.
      if (payload.id?.startsWith('conn-')) return;
      setNotifications((prev) => [payload, ...prev].slice(0, MAX_TOASTS));
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== payload.id));
      }, TOAST_DURATION_MS);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [admin, token]);

  const handleLogin = async (email: string, password: string) => {
    setLoginLoading(true);
    try {
      const response = await loginAdmin(email, password);
      if (response.user.role !== 'ADMIN') {
        setAuthError('Akun ini bukan Admin HRD. Gunakan akun dengan peran ADMIN.');
        return;
      }
      setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setAdmin(response.user);
      setActiveTab('employees');
      await Promise.all([
        loadEmployees(response.accessToken, ''),
        loadAttendance(response.accessToken, {
          from: getJakartaMonthStartString(),
          to: getJakartaDateString(),
          search: '',
        }),
      ]);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Login gagal. Periksa kembali email dan kata sandi Anda.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const requireToken = (): string => {
    if (!token) {
      throw new Error('Sesi admin tidak ditemukan. Silakan masuk kembali.');
    }
    return token;
  };

  const handleCreate = async (payload: EmployeeFormPayload) => {
    const created = await createEmployee(requireToken(), payload);
    setSuccessMessage(`Karyawan ${created.name} berhasil ditambahkan.`);
    await loadEmployees(requireToken(), '');
  };

  const handleUpdate = async (id: string, payload: EmployeeFormPayload) => {
    const updated = await updateEmployee(requireToken(), id, payload);
    setSuccessMessage(`Data ${updated.name} berhasil diperbarui.`);
    await loadEmployees(requireToken(), '');
  };

  const handleDelete = async (id: string) => {
    const removed = await deleteEmployee(requireToken(), id);
    setSuccessMessage(`Karyawan ${removed.email} berhasil dihapus.`);
    await Promise.all([
      loadEmployees(requireToken(), ''),
      loadAttendance(requireToken(), { from: filterFrom, to: filterTo, search: filterSearch }),
    ]);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" label="Memeriksa sesi Admin HRD..." />
      </div>
    );
  }

  if (!token || !admin) {
    return (
      <LoginView
        onLogin={handleLogin}
        loading={loginLoading}
        error={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  return (
    <>
      <AdminLayout
        admin={admin}
        activeTab={activeTab}
        socketConnected={socketConnected}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      >
        {activeTab === 'employees' ? (
          <EmployeeManager
            employees={employees}
            loading={employeesLoading}
            error={employeesError}
            successMessage={successMessage}
            onDismissMessages={() => {
              setEmployeesError(null);
              setSuccessMessage(null);
            }}
            onSearch={(search) => void loadEmployees(token, search)}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <AttendanceMonitor
            rows={attendanceRows}
            loading={attendanceLoading}
            error={attendanceError}
            filterFrom={filterFrom}
            filterTo={filterTo}
            filterSearch={filterSearch}
            onApplyFilter={(filter) => void loadAttendance(token, filter)}
          />
        )}
      </AdminLayout>
      <NotificationToasts
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((item) => item.id !== id))}
      />
    </>
  );
};
