const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI = process.env.MONGO_URI || "";

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.ejs"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "angry-birds-vm",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI mangler. Sett den i .env");
    }

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    app.listen(PORT, HOST, () => {
      console.log(`Server kjører på http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Oppstart feilet:", error.message);
    process.exit(1);
  }
}

start();
