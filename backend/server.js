const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Created uploads directory");
}

// Serve uploads
app.use("/uploads", express.static(uploadsDir));

// Routes
const uploadRoutes = require("./upload");
app.use("/api/upload", uploadRoutes);

// Serve frontend
app.use(express.static(path.join(__dirname, "..")));

// Dynamic PORT for Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
