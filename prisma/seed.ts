import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const adminUser = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const salesPass = process.env.SEED_SALES_PASSWORD || "vertrieb123";

  // Plattform-Mandant (gleiche ID wie in der Migration, damit Seed und Migration zusammenpassen)
  const platform = await db.tenant.upsert({
    where: { slug: "function-concept" },
    update: {},
    create: { id: "tenant_function_concept", slug: "function-concept", name: "Function Concept" },
  });

  await db.user.upsert({
    where: { tenantId_username: { tenantId: platform.id, username: adminUser } },
    update: { isPlatformAdmin: true },
    create: {
      tenantId: platform.id,
      username: adminUser,
      email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
      displayName: "Admin",
      role: "ADMIN",
      isPlatformAdmin: true,
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
      where: { tenantId_username: { tenantId: platform.id, username: s.username } },
      update: {},
      create: { ...s, tenantId: platform.id, role: "SALES", passwordHash: await bcrypt.hash(salesPass, 12), distOrder: i + 1 },
    });
  }

  // Entwicklungs-Mandant: lokal unter http://dev.localhost:3000, alle Feature-Schalter aktiv
  const dev = await db.tenant.upsert({
    where: { slug: "dev" },
    update: {},
    create: {
      slug: "dev",
      name: "Entwicklung",
      isDevelopment: true,
      domains: { create: { hostname: "dev.localhost:3000", verified: true } },
    },
  });
  const devUsers = [
    { username: "admin", displayName: "Dev Admin", email: "dev-admin@example.com", role: "ADMIN" as const },
    { username: "test1", displayName: "Test Vertrieb 1", email: "test1@example.com", role: "SALES" as const },
    { username: "test2", displayName: "Test Vertrieb 2", email: "test2@example.com", role: "SALES" as const },
  ];
  for (const [i, u] of devUsers.entries()) {
    await db.user.upsert({
      where: { tenantId_username: { tenantId: dev.id, username: u.username } },
      update: {},
      create: { ...u, tenantId: dev.id, passwordHash: await bcrypt.hash(salesPass, 12), distOrder: i },
    });
  }
  if ((await db.lead.count({ where: { tenantId: dev.id } })) === 0) {
    const test1 = await db.user.findUniqueOrThrow({ where: { tenantId_username: { tenantId: dev.id, username: "test1" } } });
    for (const [name, phone] of [
      ["Erika Testfrau", "+491701111111"],
      ["Max Testmann", "+491702222222"],
    ]) {
      await db.lead.create({
        data: {
          tenantId: dev.id,
          fullName: name,
          phone,
          email: `${name.split(" ")[0].toLowerCase()}@example.com`,
          rawJson: [],
          assignedToId: test1.id,
          activities: { create: [{ type: "CREATED" }] },
        },
      });
    }
  }

  console.log(
    `Seed fertig: Plattform-Admin "${adminUser}" (Function Concept), Vertriebler martin/selina/frances; ` +
      `Entwicklungs-Mandant unter http://dev.localhost:3000 (admin/test1/test2, Passwort aus SEED_SALES_PASSWORD).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
