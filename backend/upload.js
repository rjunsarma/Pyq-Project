const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const OpenAI = require("openai");

const router = express.Router();

/* ============================
   OPENAI SETUP
============================ */

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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
   AI AUTO-APPROVAL FUNCTION
============================ */

async function autoApproveDecisionAI({
    category,
    subject,
    year,
    semester,
    fileSize,
    fileName
}) {
    try {
        const prompt = `
You are moderating uploads for a university question paper website.

Decide if this looks like a genuine academic question paper.

Rules:
- Approve ONLY if confident
- If unsure, respond PENDING
- Never reject outright

Metadata:
Category: ${category}
Subject: ${subject}
Semester: ${semester}
Year: ${year}
File name: ${fileName}
File size: ${fileSize} bytes

Reply with exactly ONE word:
APPROVE or PENDING
        `.trim();

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a strict academic moderator." },
                { role: "user", content: prompt }
            ],
            temperature: 0
        });

        const decision = response.choices[0].message.content.trim();
        return decision === "APPROVE";

    } catch (err) {
        console.error("OpenAI error — defaulting to PENDING:", err.message);
        return false; // SAFE fallback
    }
}

/* ============================
   MULTER CONFIG
============================ */

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const uniqueName =
            crypto.randomUUID() + path.extname(file.originalname);
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

    const autoApproved = await autoApproveDecisionAI({
        category,
        subject,
        year,
        semester,
        fileSize: req.file.size,
        fileName: req.file.originalname
    });

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
