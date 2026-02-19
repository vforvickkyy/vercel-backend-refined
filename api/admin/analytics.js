import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase.from("shares").select("created_at");

  const grouped = {};

  data.forEach(row => {
    const day = new Date(row.created_at).toISOString().split("T")[0];
    grouped[day] = (grouped[day] || 0) + 1;
  });

  res.json(grouped);
}
