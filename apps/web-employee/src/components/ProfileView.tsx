import React, { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Input } from '@dexa-wfh/ui';
import {
  EmployeeProfile,
  resolvePhotoUrl,
  UpdateMyProfilePayload,
  UpdateMyProfileResponse,
} from '../api';

export interface ProfileViewProps {
  employee: EmployeeProfile;
  onUpdateProfile: (payload: UpdateMyProfilePayload) => Promise<UpdateMyProfileResponse>;
  onRefreshProfile: () => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const ProfileView: React.FC<ProfileViewProps> = ({
  employee,
  onUpdateProfile,
  onRefreshProfile,
}) => {
  const [phone, setPhone] = useState(employee.phone || '');
  const [photoUrlInput, setPhotoUrlInput] = useState(employee.photoUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPhone(employee.phone || '');
    setPhotoUrlInput(employee.photoUrl || '');
  }, [employee.phone, employee.photoUrl]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        setPreviewObjectUrl(null);
      }
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setFeedback({
        type: 'error',
        title: 'Format Foto Tidak Didukung',
        message: 'Pilih file gambar berformat JPG, JPEG, PNG, atau WEBP.',
      });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFeedback({
        type: 'error',
        title: 'Ukuran File Terlalu Besar',
        message: 'Ukuran foto maksimal adalah 5 MB.',
      });
      event.target.value = '';
      return;
    }

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    const nextPreview = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewObjectUrl(nextPreview);
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedPhone = phone.trim();
    const trimmedPhotoUrl = photoUrlInput.trim();
    const wantsPasswordChange = Boolean(
      currentPassword || newPassword || confirmPassword,
    );

    if (!trimmedPhone || trimmedPhone.length < 8) {
      setFeedback({
        type: 'error',
        title: 'Validasi Nomor Handphone',
        message: 'Nomor handphone wajib diisi minimal 8 karakter angka.',
      });
      return;
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        setFeedback({
          type: 'error',
          title: 'Kata Sandi Saat Ini Diperlukan',
          message: 'Masukkan kata sandi saat ini untuk memverifikasi perubahan kata sandi.',
        });
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setFeedback({
          type: 'error',
          title: 'Kata Sandi Baru Tidak Valid',
          message: 'Kata sandi baru wajib terdiri dari minimal 6 karakter.',
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback({
          type: 'error',
          title: 'Konfirmasi Kata Sandi Tidak Cocok',
          message: 'Pastikan konfirmasi kata sandi baru sama persis dengan kata sandi baru.',
        });
        return;
      }
    }

    const payload: UpdateMyProfilePayload = {};
    if (trimmedPhone !== (employee.phone || '')) {
      payload.phone = trimmedPhone;
    }
    if (selectedFile) {
      payload.photoFile = selectedFile;
    } else if (trimmedPhotoUrl !== (employee.photoUrl || '')) {
      payload.photoUrl = trimmedPhotoUrl;
    }
    if (wantsPasswordChange) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (
      payload.phone === undefined &&
      !payload.photoFile &&
      payload.photoUrl === undefined &&
      !payload.newPassword
    ) {
      setFeedback({
        type: 'info',
        title: 'Tidak Ada Perubahan',
        message: 'Ubah foto profil, nomor handphone, atau kata sandi terlebih dahulu sebelum menyimpan.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await onUpdateProfile(payload);
      handleClearSelectedFile();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const changedLabels =
        updated.changedFields && updated.changedFields.length > 0
          ? updated.changedFields.join(', ')
          : 'profil';

      setFeedback({
        type: 'success',
        title: 'Profil Berhasil Diperbarui',
        message: `Perubahan pada ${changedLabels} telah disimpan dan tercatat ke sistem audit HRD.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Gagal Menyimpan Perubahan',
        message:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat memperbarui profil karyawan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      await onRefreshProfile();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Gagal Memuat Ulang Profil',
        message: err instanceof Error ? err.message : 'Tidak dapat memuat profil terbaru.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const currentAvatarUrl = resolvePhotoUrl(employee.photoUrl);
  const activePreviewUrl =
    previewObjectUrl ||
    (photoUrlInput.trim() && photoUrlInput.trim() !== (employee.photoUrl || '')
      ? resolvePhotoUrl(photoUrlInput.trim())
      : currentAvatarUrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Profil Karyawan
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Informasi identitas resmi karyawan serta pengaturan foto profil, nomor handphone, dan kata sandi akun.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleRefresh()}
          loading={refreshing}
        >
          Muat Ulang Data
        </Button>
      </div>

      {feedback ? (
        <Alert
          variant={feedback.type}
          title={feedback.title}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card
            title="Identitas Karyawan"
            subtitle="Data kepegawaian terdaftar di Dexa Group"
            badge={<Badge variant="info">{employee.role}</Badge>}
          >
            <div className="flex flex-col items-center border-b border-slate-100 pb-5 text-center sm:flex-row sm:text-left">
              <Avatar
                src={currentAvatarUrl}
                name={employee.name}
                size="xl"
              />
              <div className="mt-3 sm:mt-0 sm:ml-4">
                <p className="text-lg font-bold text-slate-900">{employee.name}</p>
                <p className="text-sm font-medium text-red-700">{employee.position}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{employee.email}</p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium text-slate-500">Nama Lengkap</dt>
                <dd className="font-semibold text-slate-900">{employee.name}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium text-slate-500">Email Perusahaan</dt>
                <dd className="font-mono text-xs font-semibold text-slate-900">
                  {employee.email}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium text-slate-500">Posisi / Jabatan</dt>
                <dd className="font-semibold text-slate-900">{employee.position}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium text-slate-500">Nomor Handphone</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {employee.phone || 'Belum diisi'}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card
            title="Ubah Data Profil Karyawan"
            subtitle="Anda dapat memperbarui foto karyawan, nomor handphone, dan kata sandi akun"
          >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" noValidate>
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Foto Karyawan
                    </h3>
                    <p className="text-xs text-slate-600">
                      Unggah file foto baru (JPG, PNG, WEBP maks. 5 MB) atau masukkan URL gambar.
                    </p>
                  </div>
                  {selectedFile ? (
                    <Badge variant="success">File siap diunggah</Badge>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  {previewObjectUrl ? (
                    <img
                      src={previewObjectUrl}
                      alt={`Pratinjau foto baru ${employee.name}`}
                      width={72}
                      height={72}
                      className="h-18 w-18 shrink-0 rounded-full border border-red-300 object-cover bg-white"
                    />
                  ) : (
                    <Avatar
                      src={activePreviewUrl}
                      name={employee.name}
                      size="lg"
                    />
                  )}

                  <div className="w-full space-y-2">
                    <label
                      htmlFor="profile-photo-file"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Pilih File Foto (Multipart Upload)
                    </label>
                    <input
                      ref={fileInputRef}
                      id="profile-photo-file"
                      name="photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      disabled={submitting}
                      className="block w-full text-xs text-slate-700 file:mr-3 file:min-h-[38px] file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-100"
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                        <span className="truncate font-medium">
                          File terpilih: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelectedFile}
                          className="font-semibold text-red-700 hover:underline"
                        >
                          Batalkan file
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <Input
                  id="profile-photo-url"
                  name="photoUrl"
                  type="url"
                  label="Atau URL Foto Profil"
                  placeholder="https://contoh.com/foto-profil.jpg atau /uploads/avatars/..."
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  disabled={submitting || Boolean(selectedFile)}
                  helperText={
                    selectedFile
                      ? 'Input URL dinonaktifkan karena file upload sedang dipilih.'
                      : 'Kosongkan atau biarkan tetap sama jika tidak ingin mengubah melalui URL.'
                  }
                />
              </div>

              <div className="space-y-4">
                <Input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  label="Nomor Handphone Aktif"
                  placeholder="081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  helperText="Nomor handphone yang dapat dihubungi oleh tim HRD atau rekan kerja."
                  required
                />
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Ubah Kata Sandi Akun (Opsional)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Isi ketiga kolom di bawah ini hanya jika Anda ingin mengganti kata sandi login.
                  </p>
                </div>

                <Input
                  id="profile-current-password"
                  name="currentPassword"
                  type="password"
                  label="Kata Sandi Saat Ini"
                  placeholder="Masukkan kata sandi lama Anda"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={submitting}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="profile-new-password"
                    name="newPassword"
                    type="password"
                    label="Kata Sandi Baru"
                    placeholder="Minimal 6 karakter"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={submitting}
                  />

                  <Input
                    id="profile-confirm-password"
                    name="confirmPassword"
                    type="password"
                    label="Konfirmasi Kata Sandi Baru"
                    placeholder="Ulangi kata sandi baru"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => {
                    setPhone(employee.phone || '');
                    setPhotoUrlInput(employee.photoUrl || '');
                    handleClearSelectedFile();
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setFeedback(null);
                  }}
                >
                  Reset Formulir
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  {submitting ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Profil'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
