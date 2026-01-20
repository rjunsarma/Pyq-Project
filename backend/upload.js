const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const router = express.Router();

/* ============================
   DATABASE SETUP
============================ */

const dbDir = path.join(__dirname, "db");

// ensure db directory exists (Render-safe)
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(
    path.join(dbDir, "database.sqlite")
);

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
   MULTER CONFIG
============================ */

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
   USER UPLOAD (PENDING)
============================ */

router.post("/", upload.single("paper"), (req, res) => {
    const { category, subject, semester, year } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

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
            0 // ✅ pending
        ],
        err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
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
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // delete file if exists
                    fs.unlink(row.filePath, () => {
                        res.json({ success: true });
                    });
                }
            );
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
                fileUrl: `/uploads/${path.basename(paper.filePath)}`
            }));

            res.json(formatted);
        }
    );
});

module.exports = router;
