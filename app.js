// // app.js
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const multer = require("multer");
// const path = require("path");
// const cookieParser = require("cookie-parser");
// const logger = require("morgan");

// const app = express();
// app.use((req, res, next) => {
//   console.log(`[REQ] ${req.method} ${req.originalUrl}`);
//   next();
// });

// const uploadPath = path.join(__dirname, "uploads");

// // Konfigurasi multer untuk penyimpanan file
// const storage = multer.diskStorage({
//   destination: uploadPath,
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(
//       null,
//       `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
//     );
//   },
// });

// const upload = multer({ storage });

// const uploadDynamic = (req, res, next) => {
//   // Use `upload.fields` to define the fields for single and multiple file uploads
//   upload.fields([{ name: "foto", maxCount: 10 }])(req, res, (err) => {
//     if (err) {
//       return next(err); // Handle any upload errors
//     }

//     // Check if files were uploaded
//     if (req.files && req.files.foto) {
//       // If there is one file, convert it to an array for consistency
//       if (!Array.isArray(req.files.foto)) {
//         req.files.foto = [req.files.foto]; // Wrap the single file in an array
//       }

//       // Log the number of files uploaded
//       console.log(`Number of files uploaded: ${req.files.foto.length}`);

//       // Assign the single file to req.file if only one is uploaded
//       if (req.files.foto.length === 1) {
//         req.file = req.files.foto[0];
//       }
//     }

//     next(); // Proceed to the next middleware
//   });
// };

// // Middleware lainnya
// app.use(cors());
// app.use(uploadDynamic); // Pasang uploadDynamic untuk seluruh aplikasi
// app.use(logger("dev"));
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// // Set akses statis ke folder 'uploads'
// app.use("/uploads", express.static(uploadPath));

// // Route yang ada di aplikasi
// app.use("/", require("./routes/index"));

// module.exports = app;

// app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const app = express();

/* ======================================================
   LOG DIRECTORY
====================================================== */
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

/* ======================================================
   NON-BLOCKING LOG STREAMS (AMAN)
====================================================== */
const accessLogStream = fs.createWriteStream(path.join(logDir, "access.log"), {
  flags: "a",
});

const slowLogStream = fs.createWriteStream(path.join(logDir, "slow.log"), {
  flags: "a",
});

const errorLogStream = fs.createWriteStream(path.join(logDir, "error.log"), {
  flags: "a",
});

/* ======================================================
   REQUEST LOGGER + FREEZE DETECTOR
====================================================== */
const SLOW_THRESHOLD = 3000; // ms
let inflight = 0;

app.use((req, res, next) => {
  // log API saja
  if (!req.originalUrl.startsWith("/api")) return next();

  inflight++;
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    inflight--;
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6;

    const logLine =
      `[${new Date().toISOString()}] ` +
      `${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ${duration.toFixed(1)}ms\n`;

    // semua request API
    accessLogStream.write(logLine);

    // request lambat (biang freeze)
    if (duration > SLOW_THRESHOLD) {
      slowLogStream.write("[SLOW] " + logLine);
    }

    // request numpuk (refresh brutal)
    if (inflight > 20) {
      slowLogStream.write(
        `[OVERLOAD] ${new Date().toISOString()} inflight=${inflight} ${
          req.method
        } ${req.originalUrl}\n`
      );
    }
  });

  next();
});

/* ======================================================
   MULTER (UPLOAD) – TIDAK GLOBAL
====================================================== */
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({ storage });

const uploadDynamic = (req, res, next) => {
  if (
    !req.headers["content-type"] ||
    !req.headers["content-type"].includes("multipart/form-data")
  ) {
    return next();
  }

  upload.fields([{ name: "foto", maxCount: 10 }])(req, res, (err) => {
    if (err) return next(err);

    if (req.files && req.files.foto) {
      if (!Array.isArray(req.files.foto)) req.files.foto = [req.files.foto];
      if (req.files.foto.length === 1) req.file = req.files.foto[0];
    }
    next();
  });
};

/* ======================================================
   MIDDLEWARE UMUM
====================================================== */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadPath));

/* ======================================================
   ROUTES
====================================================== */
app.use("/", uploadDynamic, require("./routes/index"));

/* ======================================================
   GLOBAL ERROR HANDLER (ASYNC LOG)
====================================================== */
app.use((err, req, res, next) => {
  const log =
    `[${new Date().toISOString()}] ERROR ` +
    `${req.method} ${req.originalUrl}\n` +
    `${err.stack}\n\n`;

  errorLogStream.write(log);
  console.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

module.exports = app;
