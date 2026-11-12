import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';
import { hashPassword, getJakartaDateString } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

// 1x1 valid PNG binary (blue-tinted avatar placeholder)
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function ensureDefaultAvatars(uploadsDir: string) {
  const avatarsDir = path.resolve(uploadsDir, 'avatars');
  await fs.promises.mkdir(avatarsDir, { recursive: true });
  const buffer = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

  const files = ['default-admin.png', 'default-budi.png', 'default-siti.png'];
  for (const name of files) {
    const filePath = path.join(avatarsDir, name);
    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, buffer);
    }
  }
}

function getPastMonthDates(todayJakarta: string): string[] {
  const yearMonth = todayJakarta.slice(0, 7);
  const currentDay = Number.parseInt(todayJakarta.slice(8, 10), 10);
  const candidateDays = [1, 2, 3, 4, 5].filter((d) => d < currentDay);
  if (candidateDays.length === 0) {
    return [`${yearMonth}-01`];
  }
  return candidateDays.slice(0, 4).map((d) => `${yearMonth}-${String(d).padStart(2, '0')}`);
}

type SeedPasswordKey = 'SEED_ADMIN_PASSWORD' | 'SEED_EMPLOYEE_PASSWORD';

function resolveSeedPassword(envKey: SeedPasswordKey): string {
  const provided = process.env[envKey]?.trim();
  if (provided) {
    return provided;
  }
  const generated = randomBytes(12).toString('base64url');
  console.log(`[seed] ${envKey} is not set; generated password: ${generated}`);
  return generated;
}

export async function runSeed() {
  const config = loadEnvConfig();
  await ensureDefaultAvatars(config.UPLOADS_DIR);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

  try {
    const [adminPasswordHash, employeePasswordHash] = await Promise.all([
      hashPassword(resolveSeedPassword('SEED_ADMIN_PASSWORD')),
      hashPassword(resolveSeedPassword('SEED_EMPLOYEE_PASSWORD')),
    ]);

    const admin = await prisma.employee.upsert({
      where: { email: 'admin@example.com' },
      update: {
        name: 'Admin HRD Dexa',
        passwordHash: adminPasswordHash,
        position: 'HRD Manager',
        phone: '08111000111',
        photoUrl: '/uploads/avatars/default-admin.png',
        role: Role.ADMIN,
      },
      create: {
        name: 'Admin HRD Dexa',
        email: 'admin@example.com',
        passwordHash: adminPasswordHash,
        position: 'HRD Manager',
        phone: '08111000111',
        photoUrl: '/uploads/avatars/default-admin.png',
        role: Role.ADMIN,
      },
    });

    const budi = await prisma.employee.upsert({
      where: { email: 'budi.santoso@example.com' },
      update: {
        name: 'Budi Santoso',
        passwordHash: employeePasswordHash,
        position: 'Senior Software Engineer',
        phone: '081234567890',
        photoUrl: '/uploads/avatars/default-budi.png',
        role: Role.EMPLOYEE,
      },
      create: {
        name: 'Budi Santoso',
        email: 'budi.santoso@example.com',
        passwordHash: employeePasswordHash,
        position: 'Senior Software Engineer',
        phone: '081234567890',
        photoUrl: '/uploads/avatars/default-budi.png',
        role: Role.EMPLOYEE,
      },
    });

    const siti = await prisma.employee.upsert({
      where: { email: 'siti.rahma@example.com' },
      update: {
        name: 'Siti Rahma',
        passwordHash: employeePasswordHash,
        position: 'Product Designer',
        phone: '081298765432',
        photoUrl: '/uploads/avatars/default-siti.png',
        role: Role.EMPLOYEE,
      },
      create: {
        name: 'Siti Rahma',
        email: 'siti.rahma@example.com',
        passwordHash: employeePasswordHash,
        position: 'Product Designer',
        phone: '081298765432',
        photoUrl: '/uploads/avatars/default-siti.png',
        role: Role.EMPLOYEE,
      },
    });

    const todayJakarta = getJakartaDateString();
    const pastDates = getPastMonthDates(todayJakarta);

    // Clear today's attendance for seeded employees so live check-in/check-out tests can run cleanly
    await prisma.attendance.deleteMany({
      where: {
        employeeId: { in: [budi.id, siti.id] },
        date: todayJakarta,
      },
    });

    for (const dateStr of pastDates) {
      // Budi: Masuk 08:15 WIB (01:15 UTC), Pulang 17:30 WIB (10:30 UTC)
      await prisma.attendance.upsert({
        where: {
          employeeId_date_status: {
            employeeId: budi.id,
            date: dateStr,
            status: AttendanceStatus.MASUK,
          },
        },
        update: {
          timestamp: new Date(`${dateStr}T01:15:00.000Z`),
        },
        create: {
          employeeId: budi.id,
          date: dateStr,
          status: AttendanceStatus.MASUK,
          timestamp: new Date(`${dateStr}T01:15:00.000Z`),
        },
      });

      await prisma.attendance.upsert({
        where: {
          employeeId_date_status: {
            employeeId: budi.id,
            date: dateStr,
            status: AttendanceStatus.PULANG,
          },
        },
        update: {
          timestamp: new Date(`${dateStr}T10:30:00.000Z`),
        },
        create: {
          employeeId: budi.id,
          date: dateStr,
          status: AttendanceStatus.PULANG,
          timestamp: new Date(`${dateStr}T10:30:00.000Z`),
        },
      });

      // Siti: Masuk 08:30 WIB (01:30 UTC), Pulang 17:45 WIB (10:45 UTC)
      await prisma.attendance.upsert({
        where: {
          employeeId_date_status: {
            employeeId: siti.id,
            date: dateStr,
            status: AttendanceStatus.MASUK,
          },
        },
        update: {
          timestamp: new Date(`${dateStr}T01:30:00.000Z`),
        },
        create: {
          employeeId: siti.id,
          date: dateStr,
          status: AttendanceStatus.MASUK,
          timestamp: new Date(`${dateStr}T01:30:00.000Z`),
        },
      });

      await prisma.attendance.upsert({
        where: {
          employeeId_date_status: {
            employeeId: siti.id,
            date: dateStr,
            status: AttendanceStatus.PULANG,
          },
        },
        update: {
          timestamp: new Date(`${dateStr}T10:45:00.000Z`),
        },
        create: {
          employeeId: siti.id,
          date: dateStr,
          status: AttendanceStatus.PULANG,
          timestamp: new Date(`${dateStr}T10:45:00.000Z`),
        },
      });
    }

    console.log('Database seeded successfully:', {
      admin: admin.email,
      employees: [budi.email, siti.email],
      seededDates: pastDates,
    });
  } finally {
    await prisma.$disconnect();
  }
}

runSeed().catch((err) => {
  console.error('Database seed failed:', err);
  process.exit(1);
});

