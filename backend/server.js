const express = require("express");
const path = require("path");

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// expose uploads folder
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// routes
const uploadRoutes = require("./upload");
app.use("/api/upload", uploadRoutes);

// serve frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "..")));

// ✅ REQUIRED FOR RENDER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
