import mongoose from "mongoose";
import mailSender from "../utils/mailSender.js"
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 5 * 60, 
  },
});

async function sendVerificationEmail(email, otp) {
  try {
    await mailSender(email, "Verification Email from StudyNotion", otp);
  } catch (error) {
    console.log("Error occurred while sending mail", error);
  }
}

otpSchema.pre("save", async function (next) {
  await sendVerificationEmail(this.email, this.otp);
  next();
});

export const OTP = mongoose.model("OTP", otpSchema);
