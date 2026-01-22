import supabase from "../../lib/supabase";

export default async function handler(req, res) {
  const { token } = req.query;

  const { data, error } = await supabase
    .from("shares")
    .select("*")
    .eq("token", token)
    .single();

  if (!data) {
    return res.status(404).json({ error: "Link not found" });
  }

  res.json(data);
}
