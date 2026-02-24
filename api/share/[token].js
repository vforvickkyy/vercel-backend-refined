const supabase = require("../lib/supabase").default;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;

  try {
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .eq("token", token)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: "Link not found or expired" });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("SHARE ROUTE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
};