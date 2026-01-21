const express = require("express");
const path = require("path");

const app = express();

/* ============================
   MIDDLEWARE
============================ */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================
   API ROUTES
============================ */

// Upload + Admin routes
const uploadRoutes = require("./upload");

// 🔹 All upload/admin APIs will be under /api/upload
app.use("/api/upload", uploadRoutes);

/* ============================
   SERVE FRONTEND FILES
============================ */

// Serve frontend HTML/CSS/JS from project root
app.use(express.static(path.join(__dirname, "..")));

/* ============================
   FALLBACK (optional, safe)
============================ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

/* ============================
   START SERVER
============================ */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
