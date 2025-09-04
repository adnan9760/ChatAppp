import {OTP} from "../models/OTP.js"
import otpGenerator from "otp-generator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/UserModel.js";
import mailSender from "../utils/mailSender.js";
import { tryCatch } from "bullmq";

// Send OTP
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("emali",email)
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    let existingOTP = await OTP.findOne({ otp });
    while (existingOTP) {
      otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
      existingOTP = await OTP.findOne({ otp });
    }

    await OTP.deleteMany({ email });
    await OTP.create({ email, otp });
   let subject = "OTP Verification";
let html = `<div style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb; color: #333;">
  <h2 style="color: #4f46e5;">🔑 OTP Verification</h2>
  <p>Hello,</p>
  <p>Your One-Time Password (OTP) is:</p>
  <div style="font-size: 28px; font-weight: bold; margin: 20px 0; text-align: center; background: #f1f5f9; padding: 10px; border-radius: 8px; color: #111;">
    ${otp}
  </div>
  <p>This OTP will expire in <strong>10 minutes</strong>. Please do not share it with anyone.</p>
  <p style="font-size: 14px; color: #666;">If you didn’t request this, you can safely ignore this email.</p>
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
  <p style="font-size: 12px; color: #888; text-align: center;">© ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
</div>`;
  let to = email;
    await mailSender({to, subject,html});

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

// Signup
export const signup = async (req, res) => {
  try {
    const { email, password, username, otpcode } = req.body;
    console.log("emaillllllllllll",email);
    console.log("passwordddddd",password);
    console.log('otp',otpcode);
    if (!email || !password || !username || !otpcode) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
console.log('1st')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    console.log('2st')
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
    }
      console.log('3st')
    const userExist = await User.findOne({ email });
    console.log("userexit",userExist)

    if (userExist) {
      return res.status(409).json({ success: false, message: "User already exists. Please log in." });
    }

    console.log("otprecord reached soon")

    const otpRecord = await OTP.findOne({ email});
    console.log("otpRecord",otpRecord)
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const otpAge = Date.now() - otpRecord.createdAt.getTime();
    if (otpAge > 10 * 60 * 1000) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }
            console.log("hello")
    const password_hash = await bcrypt.hash(password, 12);

    const userData = await User.create({ email, username, password_hash });

    console.log("create User",userData);
    await OTP.deleteOne({ _id: otpRecord._id });

    const userResponse = userData.toObject();
    delete userResponse.password_hash;

    return res.status(201).json({
      data: userResponse,
      success: true,
      message: "User successfully registered",
    });
  } catch (error) {
    console.error("Error during signup process:", error);
    return res.status(500).json({ success: false, message: "Service temporarily unavailable. Please try again later." });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email",email);
    console.log("password",password);
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }



    const user = await User.findOne({ email }).select("+password_hash");
    console.log("Iserrrrrrr",user);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials", success: false });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);



    console.log("ispawwordvalid",isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const payload = { email: user.email, id: user._id, username: user.username };
    console.log("payoad",payload);
    const token = jwt.sign(payload, "ADNAN", { expiresIn: "24h" });

    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: "strict",
    };

    const userResponse = user.toObject();
    delete userResponse.password_hash;
console.log("userres",userResponse);
    return res.cookie("token", token, cookieOptions).status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
      success: true,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: "Login failed", success: false });
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required", success: false });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match", success: false });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
    }

    const user = await User.findOne({ email }).select("+password_hash");
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect", success: false });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password", success: false });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await User.findOneAndUpdate({ email }, { password_hash: hashedNewPassword }, { new: true });

    return res.status(200).json({ message: "Password changed successfully", success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Something went wrong", success: false });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.status(200).json({ message: "Logout successful", success: true });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ message: "Logout failed", success: false });
  }
};


