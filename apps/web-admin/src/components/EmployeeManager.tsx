import React, { useEffect, useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Input, Modal, Spinner } from '@dexa-wfh/ui';
import {
  EmployeeFormPayload,
  EmployeeProfile,
  resolvePhotoUrl,
} from '../api';

export interface EmployeeManagerProps {
  employees: EmployeeProfile[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  onDismissMessages: () => void;
  onSearch: (search: string) => void;
  onCreate: (payload: EmployeeFormPayload) => Promise<void>;
  onUpdate: (id: string, payload: EmployeeFormPayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  employee: EmployeeProfile | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: EmployeeFormPayload) => Promise<void>;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  position: '',
  phone: '',
  password: '',
  photoUrl: '',
};

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  employee,
  submitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isEdit = Boolean(employee);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      position: employee?.position ?? '',
      phone: employee?.phone ?? '',
      password: '',
      photoUrl: employee?.photoUrl ?? '',
    });
    setPhotoFile(null);
    setPreviewUrl(null);
    setValidationError(null);
  }, [isOpen, employee]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const update = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!form.name.trim() || !form.email.trim() || !form.position.trim() || !form.phone.trim()) {
      setValidationError('Nama, email, posisi, dan nomor handphone wajib diisi.');
      return;
    }
    if (!isEdit && form.password.length < 6) {
      setValidationError('Kata sandi karyawan baru minimal 6 karakter.');
      return;
    }
    if (isEdit && form.password && form.password.length < 6) {
      setValidationError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    await onSubmit({
      name: form.name,
      email: form.email,
      position: form.position,
      phone: form.phone,
      password: form.password || undefined,
      photoUrl: form.photoUrl,
      photoFile,
    });
  };

  const avatarPreview = previewUrl || resolvePhotoUrl(form.photoUrl);
  const activeError = validationError || error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Ubah Data ${employee?.name ?? 'Karyawan'}` : 'Tambah Karyawan Baru'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="employee-form" variant="primary" loading={submitting}>
            {isEdit ? 'Simpan Perubahan' : 'Simpan Karyawan'}
          </Button>
        </>
      }
    >
      {activeError ? (
        <div className="mb-4">
          <Alert variant="error" title="Data belum tersimpan">
            {activeError}
          </Alert>
        </div>
      ) : null}
      <form id="employee-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
        <div className="flex items-center gap-3">
          <Avatar src={avatarPreview} name={form.name || 'Karyawan Baru'} size="lg" />
          <div className="flex-1 space-y-2">
            <label
              htmlFor="employee-photo"
              className="block text-sm font-medium text-slate-800"
            >
              Foto Karyawan
            </label>
            <input
              id="employee-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={submitting}
              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-red-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <p className="text-xs text-slate-500">JPG, PNG, atau WEBP maksimal 5MB.</p>
          </div>
        </div>
        <Input
          id="employee-name"
          label="Nama Lengkap"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          disabled={submitting}
          required
        />
        <Input
          id="employee-email"
          type="email"
          label="Email Perusahaan"
          placeholder="nama@example.com"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          disabled={submitting}
          required
        />
        <Input
          id="employee-position"
          label="Posisi / Jabatan"
          value={form.position}
          onChange={(e) => update('position', e.target.value)}
          disabled={submitting}
          required
        />
        <Input
          id="employee-phone"
          type="tel"
          label="Nomor Handphone"
          placeholder="081234567890"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          disabled={submitting}
          required
        />
        <Input
          id="employee-photo-url"
          label="Atau URL Foto"
          placeholder="https://contoh.com/foto.jpg"
          helperText="Kosongkan jika memakai unggahan berkas atau foto bawaan."
          value={form.photoUrl}
          onChange={(e) => update('photoUrl', e.target.value)}
          disabled={submitting}
        />
        <Input
          id="employee-password"
          type="password"
          label={isEdit ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi Awal'}
          placeholder={isEdit ? 'Biarkan kosong bila tidak diubah' : 'Minimal 6 karakter'}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          disabled={submitting}
          required={!isEdit}
        />
      </form>
    </Modal>
  );
};

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  loading,
  error,
  successMessage,
  onDismissMessages,
  onSearch,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (employee: EmployeeProfile) => {
    setEditing(employee);
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: EmployeeFormPayload) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await onUpdate(editing.id, payload);
      } else {
        await onCreate(payload);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Data karyawan gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Karyawan gagal dihapus.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(searchInput);
          }}
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Input
              id="employee-search"
              label="Cari Karyawan"
              placeholder="Nama, email, atau posisi"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              Cari
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                onSearch('');
              }}
            >
              Reset
            </Button>
          </div>
        </form>
        <Button variant="primary" onClick={openCreate}>
          Tambah Karyawan
        </Button>
      </div>

      {error ? (
        <Alert variant="error" title="Gagal memuat data karyawan" onClose={onDismissMessages}>
          {error}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" title="Berhasil" onClose={onDismissMessages}>
          {successMessage}
        </Alert>
      ) : null}

      <Card
        title="Daftar Karyawan"
        subtitle={`${employees.length} karyawan ditampilkan`}
        badge={<Badge variant="neutral">Read &amp; Write</Badge>}
      >
        {loading ? (
          <div className="py-10">
            <Spinner label="Memuat data karyawan..." />
          </div>
        ) : employees.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-600">
            Belum ada karyawan yang cocok dengan pencarian.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Karyawan
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Posisi
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Nomor Handphone
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Peran
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={resolvePhotoUrl(employee.photoUrl)}
                          name={employee.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{employee.name}</p>
                          <p className="truncate text-xs text-slate-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{employee.position}</td>
                    <td className="px-3 py-3 text-slate-700">{employee.phone}</td>
                    <td className="px-3 py-3">
                      <Badge variant={employee.role === 'ADMIN' ? 'danger' : 'info'}>
                        {employee.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(employee)}>
                          Ubah
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(employee);
                          }}
                          disabled={employee.role === 'ADMIN'}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EmployeeFormModal
        isOpen={formOpen}
        employee={editing}
        submitting={submitting}
        error={formError}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Karyawan"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
              Hapus Permanen
            </Button>
          </>
        }
      >
        {deleteError ? (
          <div className="mb-4">
            <Alert variant="error" title="Gagal menghapus">
              {deleteError}
            </Alert>
          </div>
        ) : null}
        <p className="text-sm text-slate-700">
          Hapus data karyawan <span className="font-semibold">{deleteTarget?.name}</span> (
          {deleteTarget?.email})? Seluruh riwayat absensi karyawan ini juga terhapus dan tindakan
          ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
};
