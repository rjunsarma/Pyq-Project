const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

/* ============================
   ENSURE REQUIRED FOLDERS
============================ */

const uploadDir = path.join(__dirname, "uploads", "papers");
const dbDir = path.join(__dirname, "db");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* ============================
   DATABASE SETUP
============================ */

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
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + ".pdf");
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".pdf")) {
            return cb(new Error("Only PDF files are allowed"));
        }
        cb(null, true);
    }
});

/* ============================
   UPLOAD PAPER
============================ */

router.post("/", (req, res) => {
    upload.single("paper")(req, res, err => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { category, subject, semester, year } = req.body;

        db.run(
            `INSERT INTO papers VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                category,
                subject,
                semester,
                year,
                req.file.filename, // ✅ STORE ONLY FILENAME
                1 // ✅ auto-approved (change to 0 later when admin panel exists)
            ],
            err => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true });
            }
        );
    });
});

/* ============================
   GET APPROVED PAPERS (PUBLIC)
============================ */

router.get("/approved", (req, res) => {
    db.all(
        "SELECT * FROM papers WHERE approved = 1",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(
                rows.map(paper => ({
                    id: paper.id,
                    category: paper.category,
                    subject: paper.subject,
                    semester: paper.semester,
                    year: paper.year,
                    fileUrl: `/uploads/papers/${paper.filePath}` // ✅ CORRECT URL
                }))
            );
        }
    );
});

module.exports = router;
