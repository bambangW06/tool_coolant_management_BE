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
const logger = require("morgan");
const fs = require("fs");

const app = express();

// ===== FOLDER LOG OTOMATIS =====
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// ===== REQUEST LOGGING & LONG REQUEST DETECTION =====
const LONG_REQUEST_THRESHOLD = 5000; // ms
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    // log request normal
    const reqLog = `[${new Date().toISOString()}] ${req.method} ${
      req.originalUrl
    } ${res.statusCode} ${duration}ms\n`;
    fs.appendFileSync(path.join(logDir, "request.log"), reqLog);

    // log long request
    if (duration > LONG_REQUEST_THRESHOLD) {
      const longLog = `[${new Date().toISOString()}] LONG REQUEST ${
        req.method
      } ${req.originalUrl} ${duration}ms\n`;
      fs.appendFileSync(path.join(logDir, "long_requests.log"), longLog);
    }
  });

  next();
});

// ===== MULTER SETUP =====
const uploadPath = path.join(__dirname, "uploads");
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
  upload.fields([{ name: "foto", maxCount: 10 }])(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.foto) {
      if (!Array.isArray(req.files.foto)) req.files.foto = [req.files.foto];
      if (req.files.foto.length === 1) req.file = req.files.foto[0];
    }
    next();
  });
};

// ===== MIDDLEWARE LAIN =====
app.use(cors());
app.use(uploadDynamic);
app.use(logger("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadPath));

// ===== ROUTES =====
app.use("/", require("./routes/index"));

// ===== GLOBAL ERROR HANDLER =====
app.use((err, req, res, next) => {
  const errorLog = `[${new Date().toISOString()}] ERROR ${req.method} ${
    req.originalUrl
  }\n${err.stack}\n`;
  fs.appendFileSync(path.join(logDir, "error.log"), errorLog);
  console.error(errorLog); // biar muncul juga di PM2 logs
  res.status(500).json({ message: "Internal Server Error" });
});

module.exports = app;
