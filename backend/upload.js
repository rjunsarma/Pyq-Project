const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const supabase = require("../supabaseClient"); // adjust path if needed

const router = express.Router();

/* ============================
   DATABASE SETUP
============================ */

const db = new sqlite3.Database("database.sqlite");

db.run(`
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    category TEXT,
    subject TEXT,
    semester INTEGER,
    year TEXT,
    fileUrl TEXT,
    approved INTEGER DEFAULT 0
)
`);

/* ============================
   MULTER CONFIG (MEMORY)
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
   USER UPLOAD (PENDING)
============================ */

router.post("/", upload.single("paper"), async (req, res) => {
    try {
        const { category, subject, semester, year } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;
        const fileName = `${crypto.randomUUID()}.pdf`;

        // Upload to Supabase
        const { error } = await supabase.storage
            .from("papers")
            .upload(fileName, file.buffer, {
                contentType: "application/pdf"
            });

        if (error) {
            throw error;
        }

        const { data } = supabase.storage
            .from("papers")
            .getPublicUrl(fileName);

        db.run(
            `INSERT INTO papers 
             (id, category, subject, semester, year, fileUrl, approved)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                crypto.randomUUID(),
                category,
                subject,
                semester,
                year,
                data.publicUrl,
                0 // pending
            ],
            err => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true });
            }
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ============================
   ADMIN: GET PENDING
============================ */

router.get("/pending", (req, res) => {
    db.all(
        "SELECT * FROM papers WHERE approved = 0",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

/* ============================
   ADMIN: APPROVE
============================ */

router.post("/approve/:id", (req, res) => {
    db.run(
        "UPDATE papers SET approved = 1 WHERE id = ?",
        [req.params.id],
        err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

/* ============================
   ADMIN: REJECT
============================ */

router.post("/reject/:id", (req, res) => {
    db.run(
        "UPDATE papers SET approved = -1 WHERE id = ?",
        [req.params.id],
        err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

/* ============================
   ADMIN: DELETE
============================ */

router.delete("/delete/:id", (req, res) => {
    db.run(
        "DELETE FROM papers WHERE id = ?",
        [req.params.id],
        err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

/* ============================
   PUBLIC: GET APPROVED
============================ */

router.get("/approved", (req, res) => {
    db.all(
        "SELECT * FROM papers WHERE approved = 1",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const formatted = rows.map(paper => ({
                id: paper.id,
                category: paper.category,
                subject: paper.subject,
                semester: paper.semester,
                year: paper.year,
                fileUrl: paper.fileUrl
            }));

            res.json(formatted);
        }
    );
});

module.exports = router;
