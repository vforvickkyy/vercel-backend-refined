import verifyAdmin from "../lib/verifyAdmin";
import supabase from "../lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 🔐 NEW: Supabase Admin Verification
  try {
    await verifyAdmin(req);
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // ✅ USING existing supabase instance (service role)
    const { data, error } = await supabase
      .from("shares")
      .select("created_at");

    if (error) throw error;

    const grouped = {};

    data.forEach((row) => {
      const day = new Date(row.created_at)
        .toISOString()
        .split("T")[0];

      grouped[day] = (grouped[day] || 0) + 1;
    });

    return res.status(200).json(grouped);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}