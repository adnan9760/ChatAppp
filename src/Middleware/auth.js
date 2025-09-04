import jwt from 'jsonwebtoken'
import dotenv from "dotenv";
dotenv.config();

export const auth  = async (req, res, next) => {
  try {
    const authorizationHeader =
      req.cookies.token || req.body.token || req.header("Authorization");
    if (!authorizationHeader) {
      return res.json({
        message: "Authorization header or token is missing",
        success: false,
      });
    }
  
    let token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.split(" ")[1]
      : authorizationHeader;

    token = token.replace(/^"|"$/g, "");

    if (!token) {
      return res.json({
        message: "Token is missing",
        success: false,
      });
    }

    try {
      const decode = await jwt.verify(token, "ADNAN");
      console.log("decode",decode)
      req.user = decode;
      console.log("decode",req.user)
    } catch (error) {
      return res.json({
        message: "Token is not verified",
        success: false,
      });
    }
  } catch (error) {
    return res.json({
      message: "Something went wrong while verifying the token",
      success: false,
    });
  }

  next();
};