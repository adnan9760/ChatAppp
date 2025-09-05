import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import User from "./src/Router/User.js"; 
import connect from "./src/utils/databse.js"; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);

// Connect DB
connect();

// Routes
app.use("/api/v1/auth", User);

app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "Your Server Running 🚀",
  });
});

// Server
app.listen(PORT, () => {
  console.log(`App is listening at http://localhost:${PORT}`);
});
