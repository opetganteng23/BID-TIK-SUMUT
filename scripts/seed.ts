import { connectDb } from "@/lib/db";
import { About, ComplaintCategory, HeroSlide, NewsCategory, SiteSettings, User } from "@/lib/models";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { DEFAULT_MENU, DEFAULT_SECTIONS } from "@/lib/settings";
import { slugify } from "@/lib/slug";

const COMPLAINT_CATEGORIES = ["Pelayanan", "Perilaku Petugas", "Informasi dan Pengaduan", "Sarana/Prasarana", "Lainnya"];

async function main() {
  const demo = process.argv.includes("--demo");
  await connectDb();

  // Super Admin awal: hanya dari environment. Password tidak pernah dicetak.
  if ((await User.countDocuments({ role: "super_admin" })) === 0) {
    const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
    if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
      throw new Error("SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, dan SEED_ADMIN_PASSWORD wajib diisi di .env.local");
    }
    passwordSchema.parse(SEED_ADMIN_PASSWORD);
    await User.create({
      name: SEED_ADMIN_NAME,
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      role: "super_admin",
      passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
      mustChangePassword: true,
    });
    console.log(`Super Admin dibuat: ${SEED_ADMIN_EMAIL.toLowerCase()} (wajib ganti password saat login pertama)`);
  } else {
    console.log("Super Admin sudah ada, dilewati.");
  }

  await SiteSettings.updateOne(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton", menu: DEFAULT_MENU, sections: DEFAULT_SECTIONS } },
    { upsert: true },
  );
  await About.updateOne({ key: "singleton" }, { $setOnInsert: { key: "singleton" } }, { upsert: true });

  for (const [i, name] of COMPLAINT_CATEGORIES.entries()) {
    await ComplaintCategory.updateOne({ slug: slugify(name) }, { $setOnInsert: { name, slug: slugify(name), order: i, active: true } }, { upsert: true });
  }
  console.log("Kategori pengaduan dan pengaturan awal siap.");

  if (demo) {
    await NewsCategory.updateOne({ slug: "contoh" }, { $setOnInsert: { name: "Contoh", slug: "contoh" } }, { upsert: true });
    if ((await HeroSlide.countDocuments()) === 0) {
      await HeroSlide.create({
        title: "Contoh slide hero",
        description: "Data demo. Ganti dari panel admin sebelum dipakai.",
        mediaType: "image",
        enabled: false, // nonaktif: demo tidak tampil sebagai informasi resmi
        order: 0,
      });
    }
    console.log("Data demo ditambahkan (ditandai Contoh dan dinonaktifkan).");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
