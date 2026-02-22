import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ===============================
    // 1️⃣ TOTAL USERS
    // ===============================
    const { count: totalUsers } = await supabase
      .from("profiles") // or your users table
      .select("*", { count: "exact", head: true });

    // ===============================
    // 2️⃣ SHARES DATA
    // ===============================
    const { data: shares } = await supabase
      .from("shares")
      .select("*");

    const totalFiles = shares.length;
    const totalLinks = shares.length;

    const storageUsedGB =
      shares.reduce((sum, file) => sum + file.file_size, 0) /
      1024 /
      1024 /
      1024;

    // ===============================
    // 3️⃣ LAST 24 HOURS
    // ===============================
    const now = new Date();
    const last24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const linksLast24h = shares.filter(
      (s) => new Date(s.created_at) >= last24
    ).length;

    const storageLast24h =
      shares
        .filter((s) => new Date(s.created_at) >= last24)
        .reduce((sum, s) => sum + s.file_size, 0) /
      1024 /
      1024 /
      1024;

    // ===============================
    // 4️⃣ Uploads Graph (Day Wise)
    // ===============================
    const uploadsByDay = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(now.getDate() - i);

      const start = new Date(day.setHours(0, 0, 0, 0));
      const end = new Date(day.setHours(23, 59, 59, 999));

      const count = shares.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      }).length;

      uploadsByDay.push({
        label: start.toLocaleDateString("en-US", { weekday: "short" }),
        value: count,
      });
    }

    // ===============================
    // 5️⃣ Uploads Hour Wise (Last 24h)
    // ===============================
    const uploadsByHour = [];

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const count = shares.filter((s) => {
        const d = new Date(s.created_at);
        return d >= hourStart && d < hourEnd;
      }).length;

      uploadsByHour.push({
        label: hourStart.getHours() + ":00",
        value: count,
      });
    }

    // ===============================
    // 6️⃣ Recent Activity
    // ===============================
    const recentActivity = shares
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map((s) => ({
        type: "link_generated",
        file: s.file_name,
        token: s.token,
        time: new Date(s.created_at).toLocaleString(),
      }));

    // ===============================
    // 7️⃣ Cloudflare R2 Operations
    // ===============================

    const r2Res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.R2_ACCOUNT_ID}/storage/analytics`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    const r2Data = await r2Res.json();

    const classAOps =
      r2Data?.result?.metrics?.ClassAOperations || 0;

    const classBOps =
      r2Data?.result?.metrics?.ClassBOperations || 0;

    return res.status(200).json({
      totalUsers,
      totalLinks,
      totalFiles,
      liveUsers: 14, // mock for now

      linksLast24h,
      storageLast24h: Number(storageLast24h.toFixed(2)),

      storageUsedGB: Number(storageUsedGB.toFixed(2)),

      classAOps,
      classBOps,

      uploadsByDay,
      uploadsByHour,

      recentActivity,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}