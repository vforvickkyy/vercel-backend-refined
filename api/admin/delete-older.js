import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const { days } = req.body;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await supabase
    .from("shares")
    .delete()
    .lt("created_at", cutoff.toISOString());

  res.json({ success: true });
}
