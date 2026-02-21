import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔐 Authorization check
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ==============================
    // 1️⃣ Get All Files
    // ==============================

    const { data: files, error } = await supabase
      .from("shares")
      .select("*");

    if (error) throw error;

    const totalFiles = files.length;

    const storageUsed =
      files.reduce((sum, file) => sum + file.file_size, 0) /
      1024 /
      1024 /
      1024;

    const activeFiles = files.filter(
      (file) => !file.expires_at || new Date(file.expires_at) > new Date()
    ).length;

    const expiredFiles = totalFiles - activeFiles;

    const linksGenerated = totalFiles;

    // ==============================
    // 2️⃣ Daily Upload Stats (Last 7 Days)
    // ==============================

    const today = new Date();
    const dailyUploads = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(today.getDate() - i);

      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));

      const count = files.filter((file) => {
        const created = new Date(file.created_at);
        return created >= dayStart && created <= dayEnd;
      }).length;

      dailyUploads.push({
        day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
        value: count,
      });
    }

    // ==============================
    // 3️⃣ File Type Distribution
    // ==============================

    const typeMap = {};

    files.forEach((file) => {
      const ext = file.file_name.split(".").pop().toLowerCase();

      if (!typeMap[ext]) typeMap[ext] = 0;
      typeMap[ext]++;
    });

    const fileTypes = Object.entries(typeMap).map(([ext, value]) => ({
      name: ext.toUpperCase(),
      value,
    }));

    // ==============================
    // 4️⃣ Recent Activity (Last 5)
    // ==============================

    const recentActivity = files
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((file) => ({
        type: "upload",
        file: file.file_name,
        time: new Date(file.created_at).toLocaleString(),
      }));

    // ==============================
    // Final Response
    // ==============================

    return res.status(200).json({
      totalFiles,
      storageUsed: Number(storageUsed.toFixed(2)),
      linksGenerated,
      activeFiles,
      expiredFiles,
      dailyUploads,
      fileTypes,
      recentActivity,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}