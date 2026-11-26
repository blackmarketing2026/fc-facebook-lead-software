import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const adminUser = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";

  // Einziges Dashboard (gleiche ID wie in der Migration, damit Seed und Migration zusammenpassen)
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

  console.log(`Seed fertig: Admin "${adminUser}" im Dashboard Function Concept (http://localhost:3000/function-concept).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
