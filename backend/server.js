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

app.listen(5000, () => {
    console.log("Backend running on http://localhost:5000");
});
