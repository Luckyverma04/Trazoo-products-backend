import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";

import connectDB from "./src/config/db.js";
import authRoute from "./src/routes/user.route.js";
import enquiryRoute from "./src/routes/enquiry.route.js";
import giftKitRoutes from "./src/routes/giftKit.route.js";
import { createDefaultAdmin } from "./src/controllers/user.controller.js";
import proposalRequestRoute from "./src/routes/proposalRequest.route.js";

dotenv.config();

/* ======================
   DATABASE
====================== */

connectDB();

/* ======================
   APP INIT
====================== */

const app = express();

/* ======================
   CORS CONFIG
====================== */

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://trazooglobal.com",
  "https://www.trazooglobal.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin
      // (Postman, Thunder Client, server-to-server requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ CORS blocked origin:", origin);
      return callback(new Error("CORS not allowed"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/* ======================
   MIDDLEWARES
====================== */

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

/* ======================
   HEALTH CHECK
====================== */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "🚀 Trazoo backend running",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

/* ======================
   ROUTES
====================== */

app.use("/api/auth", authRoute);

app.use("/api/enquiry", enquiryRoute);

app.use("/api", giftKitRoutes);

app.use(
  "/api/proposal-requests",
  proposalRequestRoute
);

/* ======================
   SERVER START
====================== */

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`✅ Backend live on port ${PORT}`);

  // Wait 2 seconds so DB connection can initialize
  // before checking/creating the default admin.
  setTimeout(async () => {
    try {
      await createDefaultAdmin();
      console.log("✅ Default admin check completed");
    } catch (error) {
      console.error(
        "❌ Default admin error:",
        error.message
      );
    }
  }, 2000);
});

/* ===================================================
   🔥 KEEP BACKEND ALIVE (RENDER SAFE)
=================================================== */

const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL;

if (KEEP_ALIVE_URL) {
  setTimeout(() => {
    setInterval(async () => {
      try {
        await axios.get(KEEP_ALIVE_URL, {
          timeout: 5000,
        });

        console.log("🔁 Keep-alive ping success");
      } catch (error) {
        console.error(
          "❌ Keep-alive failed:",
          error.message
        );
      }
    }, 5 * 60 * 1000);
  }, 10000);
}