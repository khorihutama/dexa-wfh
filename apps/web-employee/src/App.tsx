import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner } from '@dexa-wfh/ui';
import {
  ApiError,
  AttendanceActionResponse,
  checkInAttendance,
  checkOutAttendance,
  clearStoredToken,
  DailyAttendanceSummaryItem,
  EmployeeProfile,
  fetchMyAttendanceSummary,
  fetchMyProfile,
  fetchTodayAttendance,
  getJakartaDateString,
  getJakartaMonthStartString,
  getStoredToken,
  loginEmployee,
  setStoredToken,
  TodayAttendanceStatus,
  UpdateMyProfilePayload,
  UpdateMyProfileResponse,
  updateMyProfile,
} from './api';
import { AttendanceView } from './components/AttendanceView';
import { LoginView } from './components/LoginView';
import { EmployeeMenuTab, PortalLayout } from './components/PortalLayout';
import { ProfileView } from './components/ProfileView';
import { SummaryView } from './components/SummaryView';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<EmployeeMenuTab>('attendance');

  const [authLoading, setAuthLoading] = useState<boolean>(() => Boolean(getStoredToken()));
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus | null>(null);
  const [loadingToday, setLoadingToday] = useState<boolean>(false);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [summaryItems, setSummaryItems] = useState<DailyAttendanceSummaryItem[]>([]);
  const [filterFrom, setFilterFrom] = useState<string>(() => getJakartaMonthStartString());
  const [filterTo, setFilterTo] = useState<string>(() => getJakartaDateString());
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setEmployee(null);
    setTodayStatus(null);
    setSummaryItems([]);
    setAuthError(null);
  }, []);

  const loadTodayStatus = useCallback(
    async (activeToken: string) => {
      setLoadingToday(true);
      setTodayError(null);
      try {
        const status = await fetchTodayAttendance(activeToken);
        setTodayStatus(status);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleLogout();
          return;
        }
        setTodayError(
          err instanceof Error
            ? err.message
            : 'Tidak dapat memuat status kehadiran hari ini.',
        );
      } finally {
        setLoadingToday(false);
      }
    },
    [handleLogout],
  );

  const loadSummary = useCallback(
    async (activeToken: string, from: string, to: string) => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const result = await fetchMyAttendanceSummary(activeToken, { from, to });
        setSummaryItems(result.summary || result.data || []);
        setFilterFrom(result.filter.from);
        setFilterTo(result.filter.to);
        if (result.todayStatus) {
          setTodayStatus(result.todayStatus);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleLogout();
          return;
        }
        setSummaryError(
          err instanceof Error
            ? err.message
            : 'Tidak dapat memuat rekap riwayat kehadiran.',
        );
      } finally {
        setLoadingSummary(false);
      }
    },
    [handleLogout],
  );

  const bootstrapSession = useCallback(
    async (activeToken: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const profile = await fetchMyProfile(activeToken);
        setEmployee(profile);
        await Promise.all([
          loadTodayStatus(activeToken),
          loadSummary(activeToken, getJakartaMonthStartString(), getJakartaDateString()),
        ]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearStoredToken();
          setToken(null);
          setEmployee(null);
          setAuthError('Sesi login Anda telah berakhir. Silakan masuk kembali.');
        } else {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Gagal menghubungi server API Gateway.',
          );
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [loadSummary, loadTodayStatus],
  );

  useEffect(() => {
    if (token && !employee) {
      void bootstrapSession(token);
    }
  }, [token, employee, bootstrapSession]);

  const handleLogin = async (email: string, password: string) => {
    setLoginLoading(true);
    setAuthError(null);
    try {
      const response = await loginEmployee(email, password);
      setStoredToken(response.accessToken);
      setToken(response.accessToken);
      const profile = await fetchMyProfile(response.accessToken);
      setEmployee(profile);
      setActiveTab('attendance');
      const initialFrom = getJakartaMonthStartString();
      const initialTo = getJakartaDateString();
      await Promise.all([
        loadTodayStatus(response.accessToken),
        loadSummary(response.accessToken, initialFrom, initialTo),
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

  const handleUpdateProfile = async (
    payload: UpdateMyProfilePayload,
  ): Promise<UpdateMyProfileResponse> => {
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
    }
    const updated = await updateMyProfile(token, payload);
    setEmployee({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      position: updated.position,
      phone: updated.phone,
      photoUrl: updated.photoUrl,
      role: updated.role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
    return updated;
  };

  const handleRefreshProfile = async () => {
    if (!token) return;
    const fresh = await fetchMyProfile(token);
    setEmployee(fresh);
  };

  const handleCheckIn = async (): Promise<AttendanceActionResponse> => {
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
    }
    const result = await checkInAttendance(token);
    setTodayStatus(result.todayStatus);
    await loadSummary(token, filterFrom, filterTo);
    return result;
  };

  const handleCheckOut = async (): Promise<AttendanceActionResponse> => {
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
    }
    const result = await checkOutAttendance(token);
    setTodayStatus(result.todayStatus);
    await loadSummary(token, filterFrom, filterTo);
    return result;
  };

  const handleSearchSummary = async (from: string, to: string) => {
    if (!token) return;
    await loadSummary(token, from, to);
  };

  if (authLoading && token && !employee) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-xs">
          <Spinner size="lg" label="Memverifikasi sesi karyawan..." />
        </div>
      </main>
    );
  }

  if (token && !employee && authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-bold text-slate-900">
            Kendala Koneksi Portal Karyawan
          </h1>
          <Alert variant="error" title="Tidak Dapat Memuat Profil">
            {authError}
          </Alert>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => void bootstrapSession(token)}
            >
              Coba Lagi
            </Button>
            <Button type="button" variant="outline" onClick={handleLogout}>
              Kembali ke Login
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!token || !employee) {
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
    <PortalLayout
      employee={employee}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'profile' ? (
        <ProfileView
          employee={employee}
          onUpdateProfile={handleUpdateProfile}
          onRefreshProfile={handleRefreshProfile}
        />
      ) : null}

      {activeTab === 'attendance' ? (
        <AttendanceView
          todayStatus={todayStatus}
          loadingStatus={loadingToday}
          statusError={todayError}
          onRefreshToday={() => loadTodayStatus(token)}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onNavigateSummary={() => setActiveTab('summary')}
        />
      ) : null}

      {activeTab === 'summary' ? (
        <SummaryView
          items={summaryItems}
          filterFrom={filterFrom}
          filterTo={filterTo}
          loading={loadingSummary}
          error={summaryError}
          onSearchFilter={handleSearchSummary}
        />
      ) : null}
    </PortalLayout>
  );
};
