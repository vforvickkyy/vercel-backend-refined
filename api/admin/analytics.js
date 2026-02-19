import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("shares")
      .select("created_at");

    if (error) throw error;

    const grouped = {};

    data.forEach(row => {
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
