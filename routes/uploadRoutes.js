const express = require("express");
const multer = require("multer");
const path = require("path");
const Image = require("../models/Image");

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Route for image upload
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = `http://localhost:5005/uploads/${req.file.filename}`;
    const newImage = new Image({ imageUrl });

    await newImage.save();

    res.status(201).json({ message: "Image uploaded", imageUrl });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
