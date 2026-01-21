const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const pdfParse = require("pdf-parse");

const router = express.Router();

/* ============================
   DATABASE SETUP
============================ */

const dbDir = path.join(__dirname, "db");
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, "database.sqlite"));

db.run(`
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    category TEXT,
    subject TEXT,
    semester INTEGER,
    year TEXT,
    filePath TEXT,
    approved INTEGER DEFAULT 0
)
`);

/* ============================
   UPLOADS DIRECTORY
============================ */

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ============================
   PDF AUTO-APPROVAL LOGIC
============================ */

async function autoApproveFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);

        // Use only first part of text (fast + safe)
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
            if (text.includes(word)) {
                matches++;
            }
        }

        // ✅ approve if at least 2 academic signals found
        return matches >= 2;

    } catch (err) {
        console.error("PDF parse failed, keeping pending:", err.message);
        return false; // safe fallback
    }
}

/* ============================
   MULTER CONFIG
============================ */

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files allowed"));
        }
        cb(null, true);
    }
});

/* ============================
   USER UPLOAD ROUTE
============================ */

router.post("/", upload.single("paper"), async (req, res) => {
    const { category, subject, semester, year } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // 🔒 DUPLICATE CHECK
    db.get(
        `SELECT id FROM papers
         WHERE category = ? AND subject = ? AND semester = ? AND year = ?`,
        [category, subject, semester, year],
        async (err, existing) => {
            if (existing) {
                fs.unlink(req.file.path, () => {});
                return res.status(409).json({
                    error: "This paper already exists."
                });
            }

            // 🔍 AUTO-APPROVAL FROM PDF CONTENT
            const autoApproved = await autoApproveFromPDF(req.file.path);

            db.run(
                `INSERT INTO papers
                (id, category, subject, semester, year, filePath, approved)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(),
                    category,
                    subject,
                    semester,
                    year,
                    req.file.path,
                    autoApproved ? 1 : 0
                ],
                err => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    res.json({
                        success: true,
                        autoApproved
                    });
                }
            );
        }
    );
});

/* ============================
   ADMIN ROUTES
============================ */

router.get("/pending", (req, res) => {
    db.all("SELECT * FROM papers WHERE approved = 0", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post("/approve/:id", (req, res) => {
    db.run(
        "UPDATE papers SET approved = 1 WHERE id = ?",
        [req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

router.post("/reject/:id", (req, res) => {
    db.run(
        "UPDATE papers SET approved = -1 WHERE id = ?",
        [req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

router.delete("/delete/:id", (req, res) => {
    db.get(
        "SELECT filePath FROM papers WHERE id = ?",
        [req.params.id],
        (err, row) => {
            if (err || !row) {
                return res.status(404).json({ error: "Paper not found" });
            }

            db.run(
                "DELETE FROM papers WHERE id = ?",
                [req.params.id],
                err => {
                    if (err) return res.status(500).json({ error: err.message });

                    fs.unlink(row.filePath, () => {
                        res.json({ success: true });
                    });
                }
            );
        }
    );
});

/* ============================
   PUBLIC ROUTE
============================ */

router.get("/approved", (req, res) => {
    db.all("SELECT * FROM papers WHERE approved = 1", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const formatted = rows.map(paper => ({
            id: paper.id,
            category: paper.category,
            subject: paper.subject,
            semester: paper.semester,
            year: paper.year,
            fileUrl: `/uploads/${path.basename(paper.filePath)}`
        }));

        res.json(formatted);
    });
});

module.exports = router;
