import verifyAdmin from "../lib/verifyAdmin";
import supabase from "../lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 🔐 Admin Verification
  try {
    await verifyAdmin(req);
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}