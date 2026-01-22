import supabase from "../../lib/supabase";

export default async function handler(req, res) {
  // ✅ CORS HEADERS (REQUIRED)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { token } = req.query;

  try {
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .eq("token", token)
      .single();

    if (!data) {
      return res.status(404).json({ error: "Link not found or expired" });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
