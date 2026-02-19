import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const { id } = req.body;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase.from("shares").delete().eq("id", id);

  res.json({ success: true });
}
