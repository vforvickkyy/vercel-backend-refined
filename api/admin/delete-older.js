import verifyAdmin from "../lib/verifyAuth";
import supabase from "../lib/supabase";

export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader(
  "Access-Control-Allow-Methods",
  "GET,POST,PUT,DELETE,OPTIONS"
);
res.setHeader(
  "Access-Control-Allow-Headers",
  "Content-Type, Authorization"
);

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
    const { days } = req.body;

    if (!days) {
      return res.status(400).json({ message: "Missing days" });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { error } = await supabase
      .from("shares")
      .delete()
      .lt("created_at", cutoff.toISOString());

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}