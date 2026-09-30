import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const adminUser = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const salesPass = process.env.SEED_SALES_PASSWORD || "vertrieb123";

  await db.user.upsert({
    where: { username: adminUser },
    update: {},
    create: {
      username: adminUser,
      email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
      displayName: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPass, 12),
      distOrder: 0,
    },
  });

  const sales = [
    { username: "martin", displayName: "Martin", email: "martin@example.com" },
    { username: "selina", displayName: "Selina", email: "selina@example.com" },
    { username: "frances", displayName: "Frances", email: "frances@example.com" },
  ];
  for (const [i, s] of sales.entries()) {
    await db.user.upsert({
      where: { username: s.username },
      update: {},
      create: { ...s, role: "SALES", passwordHash: await bcrypt.hash(salesPass, 12), distOrder: i + 1 },
    });
  }
  console.log(`Seed fertig: Admin "${adminUser}", Vertriebler martin/selina/frances (Startpasswort aus SEED_SALES_PASSWORD).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
