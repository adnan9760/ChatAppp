const OTP = require("../Model/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const { User } = require("../models/UserModel");
const mailSender = require('../utils/mailSender');

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Input validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Generate unique OTP
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // Ensure OTP uniqueness
    let existingOTP = await OTP.findOne({ otp });
    while (existingOTP) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });
      existingOTP = await OTP.findOne({ otp });
    }

    // Clean up old OTPs for this email
    await OTP.deleteMany({ email });

    // Create new OTP record
    const otpPayload = { email, otp };
    await OTP.create(otpPayload);

    // Send OTP via email
    await mailSender(email, "OTP Verification", `Your OTP is: ${otp}`);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Signup
exports.signup = async (req, res) => {
  try {
    const { email, password, username, otp } = req.body;

    // Input validation
    if (!email || !password || !username || !otp) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if user already exists
    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message: "User already exists. Please log in.",
      });
    }

    // Verify OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check OTP expiry (assuming OTP expires in 10 minutes)
    const otpAge = Date.now() - otpRecord.createdAt.getTime();
    if (otpAge > 10 * 60 * 1000) { // 10 minutes
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = await User.create({
      email,
      username,
      password_hash,
    });

    // Clean up OTP after successful registration
    await OTP.deleteOne({ _id: otpRecord._id });

    // Remove password from response
    const userResponse = userData.toObject();
    delete userResponse.password_hash;

    return res.status(201).json({
      data: userResponse,
      success: true,
      message: "User successfully registered",
    });
  } catch (error) {
    console.error("Error during signup process:", error);
    return res.status(500).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password_hash');
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Create JWT payload
    const payload = {
      email: user.email,
      id: user._id,
      username: user.username,
    };

    // Generate JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    // Set cookie options
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };

    // Remove password from user object
    const userResponse = user.toObject();
    delete userResponse.password_hash;

    return res
      .cookie("token", token, cookieOptions)
      .status(200)
      .json({
        message: "Login successful",
        token,
        user: userResponse,
        success: true,
      });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      message: "Login failed",
      success: false,
    });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;

    // Input validation
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New passwords do not match",
        success: false,
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password_hash');
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message: "Current password is incorrect",
        success: false,
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
        success: false,
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findOneAndUpdate(
      { email },
      { password_hash: hashedNewPassword },
      { new: true }
    );

    return res.status(200).json({
      message: "Password changed successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.status(200).json({
      message: "Logout successful",
      success: true,
    });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({
      message: "Logout failed",
      success: false,
    });
  }
};