import verifyAdmin from "../lib/verifyAdmin";
import supabase from "../lib/supabase";

export default async function handler(req, res) {

  // ✅ ALWAYS FIRST: CORS
export default async function handler(req, res) {
  const allowedOrigins = [
    "https://k4c4zc.csb.app"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
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

const origin = req.headers.origin;

if (allowedOrigins.includes(origin)) {
  res.setHeader("Access-Control-Allow-Origin", origin);
}
  // ✅ Handle preflight BEFORE anything else
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ✅ THEN verify admin
    await verifyAdmin(req);

    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);

  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
}