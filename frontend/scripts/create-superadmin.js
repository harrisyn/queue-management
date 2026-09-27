const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
      console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD - no default credentials in production.');
      process.exitCode = 1;
      return;
    }
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'AdminPass123!';
    const firstName = process.env.ADMIN_FIRSTNAME || 'Super';
    const lastName = process.env.ADMIN_LASTNAME || 'Admin';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
      },
    });

    console.log('Created super admin:', user.email, 'password:', password);
  } catch (err) {
    console.error('Failed creating admin', err);
    process.exit(1);
  } finally {
    // don't wait
  }
}

main();
