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

// ✅ ensure db directory exists (Render fix)
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },
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

router.post("/", upload.single("paper"), (req, res) => {
    const { category, subject, semester, year } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    db.run(
        `INSERT INTO papers VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            crypto.randomUUID(),
            category,
            subject,
            semester,
            year,
            req.file.path,
            0
        ],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

/* ============================
   GET APPROVED PAPERS
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
