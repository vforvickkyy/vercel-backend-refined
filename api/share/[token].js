import supabase from "../../lib/supabase";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // ✅ CORS (CRITICAL)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

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
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Link not found or expired" });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
