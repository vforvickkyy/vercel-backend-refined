import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ============================
  // CORS CONFIG
  // ============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ============================
    // AUTH CHECK
    // ============================
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ============================
    // FETCH SHARES
    // ============================
    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Database error" });
    }

    const safeShares = shares || [];

    // ============================
    // BASIC COUNTS
    // ============================

    const totalFiles = safeShares.length;
    const totalLinks = safeShares.length; // same for now

    // 🔹 FUTURE: Replace with distinct user_id count
    const totalUsers = totalFiles;

    // ============================
    // STORAGE CALCULATION (GB)
    // ============================

    const totalStorageBytes = safeShares.reduce(
      (sum, file) => sum + (file.file_size || 0),
      0
    );

    const storageUsedGB = Number(
      (totalStorageBytes / 1024 / 1024 / 1024).toFixed(2)
    );

    // ============================
    // LAST 24 HOURS
    // ============================

    const now = new Date();
    const last24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const sharesLast24 = safeShares.filter(
      (s) => new Date(s.created_at) >= last24
    );

    const linksLast24h = sharesLast24.length;

    const storageLast24h = Number(
      (
        sharesLast24.reduce(
          (sum, s) => sum + (s.file_size || 0),
          0
        ) /
        1024 /
        1024 /
        1024
      ).toFixed(2)
    );

    // ============================
    // UPLOADS BY DAY (7 days)
    // ============================

    const uploadsByDay = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(now.getDate() - i);

      const start = new Date(day.setHours(0, 0, 0, 0));
      const end = new Date(day.setHours(23, 59, 59, 999));

      const count = safeShares.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      }).length;

      uploadsByDay.push({
        label: start.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        value: count,
      });
    }

    // ============================
    // UPLOADS BY HOUR (Last 24h)
    // ============================

    const uploadsByHour = [];

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(
        now.getTime() - i * 60 * 60 * 1000
      );
      const hourEnd = new Date(
        hourStart.getTime() + 60 * 60 * 1000
      );

      const count = safeShares.filter((s) => {
        const d = new Date(s.created_at);
        return d >= hourStart && d < hourEnd;
      }).length;

      uploadsByHour.push({
        label: hourStart.getHours() + ":00",
        value: count,
      });
    }

    // ============================
    // RECENT ACTIVITY (Last 10)
    // ============================

    const recentActivity = safeShares
      .sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      )
      .slice(0, 10)
      .map((s) => ({
        type: "link_generated",
        file: s.file_name,
        token: s.token,
        time: new Date(s.created_at).toLocaleString(),
      }));

    // ============================
    // MOCK R2 DATA (Replace later)
    // ============================

    const classAOps = 0;
    const classBOps = 0;

    // ============================
    // RESPONSE
    // ============================

    return res.status(200).json({
      totalUsers,
      totalFiles,
      totalLinks,

      storageUsedGB,

      linksLast24h,
      storageLast24h,

      liveUsers: 12, // mock

      uploadsByDay,
      uploadsByHour,

      recentActivity,

      classAOps,
      classBOps,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
    });
  }
}