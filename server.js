const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
require("dotenv").config({ path: path.join(__dirname, "config", ".env") });

const { uploadToStorage } = require("./config/supabaseStorage");

const app = express();

const SCREENSHOT_BUCKET = "payment-screenshots";

// Memory storage — no disk writes, buffer goes straight to Supabase Storage.
// (Vercel's filesystem is read-only outside /tmp, so local disk storage
// would silently fail/disappear there.)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(
        new Error("Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed."),
      );
    }
  },
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// Routes Imports
const productRoutes = require("./routes/ProductRoutes");
const orderRoutes = require("./routes/OrderRoutes");
const adminRoutes = require("./routes/AdminRoutes");
const categoryRoutes = require("./routes/CategoryRoutes");
const userRoutes = require("./routes/UserRoutes");

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);

// Payment screenshot upload endpoint — now uploads to Supabase Storage
app.post(
  "/api/upload-payment-screenshot",
  upload.single("screenshot"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    try {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const filename = `payment-${uniqueSuffix}${path.extname(req.file.originalname)}`;

      const publicUrl = await uploadToStorage(
        SCREENSHOT_BUCKET,
        req.file.buffer,
        filename,
        req.file.mimetype,
      );

      res.json({
        filename,
        path: publicUrl,
        url: publicUrl,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Screenshot upload failed", details: error.message });
    }
  },
);

// ✅ Fix: Catch-all route ke liye regex use karein jo Express handle kar sake
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 5000;

// Local development mein normal listen karo.
// Vercel pe khud module ko serverless function ki tarah invoke karta hai,
// is liye wahan app.listen() nahi chalna chahiye — process.env.VERCEL
// Vercel apne runtime mein automatically set karta hai.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
