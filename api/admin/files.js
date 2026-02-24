import supabase from "../../lib/supabase.js";

export default async function handler(req, res) {
  // =============================
  // CORS
  // =============================
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

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // =============================
    // FETCH SHARES (NO AUTH FOR NOW)
    // =============================
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Server error:", err);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}