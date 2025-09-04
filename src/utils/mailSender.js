import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const mailSender = async ({to, subject, html}) => {


  console.log("emaillll inside mailsender",to);
  console.log("title inside mailserder",subject);
  console.log("body inside mailsender",html);
  try {
    let transporter = nodemailer.createTransport({
      host:'smtp.gmail.com',
      auth: {
        user:'ak9760049@gmail.com',
        pass: "prwe pruu kcxh xcnp"
      },
    });

    let info = await transporter.sendMail({
      from: "ChatApp - by Adnan",
      to: to,
      subject: subject,
      html: html,
    });

    return info;
  } catch (error) {
    console.log("Mail send error:", error.message);
  }
};

export default mailSender;
