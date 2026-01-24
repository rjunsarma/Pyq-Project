const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const supabase = require("./supabaseClient");

const router = express.Router();

/* ============================
   ADMIN AUTH MIDDLEWARE
============================ */

function adminAuth(req, res, next) {
    const adminKey = req.headers["x-admin-key"];

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    next();
}

/* ============================
   MULTER (MEMORY STORAGE)
============================ */

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files allowed"));
        }
        cb(null, true);
    }
});

/* ============================
   PDF AUTO-APPROVAL
============================ */

async function autoApproveFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        const text = data.text.toLowerCase().slice(0, 1500);

        const keywords = [
            "time",
            "full marks",
            "maximum marks",
            "duration",
            "semester",
            "examination",
            "exam",
            "question paper",
            "paper code",
            "university",
            "instructions"
        ];

        let matches = 0;
        for (const word of keywords) {
            if (text.includes(word)) matches++;
        }

        return matches >= 2;
    } catch (err) {
        console.error("PDF parse failed:", err.message);
        return false;
    }
}

/* ============================
   USER UPLOAD ROUTE (PUBLIC)
============================ */

router.post("/", upload.single("paper"), async (req, res) => {
    const { category, subject, semester, year } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // 🔒 DUPLICATE CHECK
    const { data: existing } = await supabase
        .from("papers")
        .select("id")
        .eq("category", category)
        .eq("subject", subject)
        .eq("semester", semester)
        .eq("year", year)
        .single();

    if (existing) {
        return res.status(409).json({
            error: "This paper already exists."
        });
    }

    // 🔍 AUTO APPROVAL
    const autoApproved = await autoApproveFromPDF(req.file.buffer);

    // 📤 UPLOAD TO SUPABASE STORAGE
    const fileName = `${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await supabase.storage
        .from("papers")
        .upload(fileName, req.file.buffer, {
            contentType: "application/pdf"
        });

    if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrl } = supabase.storage
        .from("papers")
        .getPublicUrl(fileName);

    // 🗄 INSERT INTO DB
    const { error: insertError } = await supabase
        .from("papers")
        .insert([{
            category,
            subject,
            semester,
            year,
            file_url: publicUrl.publicUrl,
            approved: autoApproved ? 1 : 0
        }]);

    if (insertError) {
        return res.status(500).json({ error: insertError.message });
    }

    res.json({
        success: true,
        autoApproved
    });
});

/* ============================
   ADMIN ROUTES (PROTECTED)
============================ */

router.get("/pending", adminAuth, async (req, res) => {
    const { data, error } = await supabase
        .from("papers")
        .select("*")
        .eq("approved", 0);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post("/approve/:id", adminAuth, async (req, res) => {
    const { error } = await supabase
        .from("papers")
        .update({ approved: 1 })
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.post("/reject/:id", adminAuth, async (req, res) => {
    const { error } = await supabase
        .from("papers")
        .update({ approved: -1 })
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete("/delete/:id", adminAuth, async (req, res) => {
    const { data } = await supabase
        .from("papers")
        .select("file_url")
        .eq("id", req.params.id)
        .single();

    if (!data) return res.status(404).json({ error: "Not found" });

    const fileName = data.file_url.split("/").pop();

    await supabase.storage.from("papers").remove([fileName]);
    await supabase.from("papers").delete().eq("id", req.params.id);

    res.json({ success: true });
});

/* ============================
   PUBLIC ROUTE
============================ */

router.get("/approved", async (req, res) => {
    const { data, error } = await supabase
        .from("papers")
        .select("*")
        .eq("approved", 1);

    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(paper => ({
        id: paper.id,
        category: paper.category,
        subject: paper.subject,
        semester: paper.semester,
        year: paper.year,
        fileUrl: paper.file_url
    }));

    res.json(formatted);
});

module.exports = router;
