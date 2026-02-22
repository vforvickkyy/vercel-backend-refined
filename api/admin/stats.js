import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // ===== CORS =====
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
    // ===== AUTH =====
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ===== INIT SUPABASE SAFELY HERE =====
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({ message: "Missing Supabase ENV" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      return res.status(500).json({ message: "DB error" });
    }

    const safeShares = shares || [];

    return res.status(200).json({
      totalFiles: safeShares.length,
      totalLinks: safeShares.length,
      recentActivity: [],
      storageUsedFormatted: "0 MB",
      classAOps: 0,
      classBOps: 0,
      linksLast24h: 0,
      totalUsers: 0,
      liveUsers: 0
    });

  } catch (err) {
    console.error("STATS CRASH:", err);
    return res.status(500).json({ message: "Server crash" });
  }
}