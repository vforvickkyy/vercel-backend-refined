import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  // 🔥 CORS MUST BE FIRST
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // 🔥 OPTIONS MUST EXIT IMMEDIATELY
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      return res.status(500).json({ message: "DB error" });
    }

    const safeShares = shares || [];

    const totalFiles = safeShares.length;

    return res.status(200).json({
      totalFiles,
      totalLinks: totalFiles,
      totalUsers: totalFiles,
      liveUsers: 12,
      linksLast24h: 0,
      storageUsedFormatted: "0 MB",
      classAOps: 0,
      classBOps: 0,
      recentActivity: [],
    });

  } catch (err) {
    console.error("STATS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}