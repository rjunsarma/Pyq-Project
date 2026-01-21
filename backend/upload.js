const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const supabase = require("./supabaseClient");

const router = express.Router();

/* ============================
   MULTER (MEMORY)
============================ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  }
});

/* ============================
   USER UPLOAD (PENDING)
============================ */
router.post("/", upload.single("paper"), async (req, res) => {
  try {
    const { category, subject, semester, year } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    /* 🔒 BLOCK DUPLICATE UPLOADS */
    const { data: existing, error: dupError } = await supabase
      .from("papers")
      .select("id")
      .eq("category", category)
      .eq("subject", subject)
      .eq("semester", semester)
      .eq("year", year)
      .in("status", ["pending", "approved"])
      .limit(1);

    if (dupError) {
      return res.status(500).json({ error: dupError.message });
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: "This paper already exists or is pending approval"
      });
    }

    const fileName = `${crypto.randomUUID()}.pdf`;

    /* Upload PDF to Supabase Storage */
    const { error: uploadError } = await supabase.storage
      .from("papers")
      .upload(fileName, req.file.buffer, {
        contentType: "application/pdf"
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage
      .from("papers")
      .getPublicUrl(fileName);

    /* Insert metadata */
    const { error: dbError } = await supabase
      .from("papers")
      .insert({
        category,
        subject,
        semester,
        year,
        file_url: data.publicUrl,
        status: "pending",
        approved: false
      });

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ============================
   ADMIN: GET PENDING
============================ */
router.get("/pending", async (req, res) => {
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .eq("status", "pending");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ============================
   ADMIN: APPROVE
============================ */
router.post("/approve/:id", async (req, res) => {
  const { error } = await supabase
    .from("papers")
    .update({
      status: "approved",
      approved: true
    })
    .eq("id", req.params.id)
    .eq("status", "pending");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/* ============================
   ADMIN: REJECT
============================ */
router.post("/reject/:id", async (req, res) => {
  const { error } = await supabase
    .from("papers")
    .update({
      status: "rejected",
      approved: false
    })
    .eq("id", req.params.id)
    .eq("status", "pending");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/* ============================
   ADMIN: DELETE (APPROVED)
============================ */
router.delete("/delete/:id", async (req, res) => {
  const { error } = await supabase
    .from("papers")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/* ============================
   PUBLIC: GET APPROVED
============================ */
router.get("/approved", async (req, res) => {
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
