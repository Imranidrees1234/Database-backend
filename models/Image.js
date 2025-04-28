const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true } // Store image path or URL
}, { timestamps: true });

module.exports = mongoose.model("Image", imageSchema);
