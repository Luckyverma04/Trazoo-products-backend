import { User } from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import sendEmail from "../utils/sendEmail.js";
import Enquiry from "../models/enquiry.model.js";
// -----------------------------------------
// 📌 Send OTP Email
// -----------------------------------------
const sendOTPEmail = async (email, otp) => {
  await sendEmail({
    to: email,
    subject: "Your Email Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your OTP is: <b>${otp}</b></h2>
        <p>OTP expires in 15 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
};

// -----------------------------------------
// 📝 REGISTER USER (Send OTP)
// -----------------------------------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
  const existingUser = await User.findOne({ email });

// =========================
// USER EXISTS
// =========================
if (existingUser) {

  // already verified
  if (existingUser.isEmailVerified) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  // NOT verified yet
  const otp = existingUser.generateOTP();

  await existingUser.save();

  await sendOTPEmail(email, otp);

  return res.status(200).json({
    success: true,
    message: "Account exists but not verified. New OTP sent.",
  });
}

    // Create user → ALWAYS customer
    const user = new User({
      name,
      email,
      password,
      role: "customer",
    });

    // Generate OTP
    const otp = user.generateOTP();

    // Save user
    await user.save();

    // Send OTP via email
    await sendOTPEmail(email, otp);

    res.status(201).json({
      success: true,
      message: "User registered. OTP sent to email.",
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------
// 🔐 VERIFY EMAIL OTP
// -----------------------------------------
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select("+otp +otpExpires");

    if (!user) return res.status(400).json({ message: "User not found" });

    const isValidOTP = user.verifyOTP(otp);
    if (!isValidOTP)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;

    await user.save();
const token = jwt.sign(
  {
    id: user._id,
    role: user.role,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
  }
);

res.json({
  success: true,
  message: "Email verified successfully",
  token,
  user: {
    name: user.name,
    email: user.email,
    role: user.role,
  },
});

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const resendOTP = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "User already verified",
      });
    }

    const otp = user.generateOTP();

    await user.save();

    await sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: "OTP resent successfully",
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// -----------------------------------------
// 🔑 LOGIN USER
// -----------------------------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.isEmailVerified)
      return res.status(403).json({ message: "Email not verified" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------
// 🛠 AUTO-CREATE DEFAULT ADMIN (ONLY ONCE)
// -----------------------------------------
export const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      const admin = new User({
        name: "Super Admin",
        email: "admin@trazoo.com",
        password: "Admin@123",
        role: "admin",
        isEmailVerified: true,
      });

      await admin.save();
      console.log("✔ Default Admin Created ➜ Email: admin@trazoo.com | Password: Admin@123");
    }
  } catch (error) {
    console.log("Admin creation error:", error.message);
  }
};

// -----------------------------------------
// 👥 GET ALL USERS (Admin) - FIXED
// -----------------------------------------
export const getAllUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    // Build search filter
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { role: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Get users with pagination
    const users = await User.find(filter)
      .select("-password -otp -otpExpires")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalUsers = await User.countDocuments(filter);

    // Return users array directly (frontend expects array)
    res.json(users);

  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------
// 👤 GET USER BY ID (Admin)
// -----------------------------------------
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password -otp -otpExpires");

    if (!user)
      return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalLeads = await Enquiry.countDocuments();

    // 🟡 Pending = Not assigned to any associate yet
    const pendingLeads = await Enquiry.countDocuments({
      assignedTo: null,
      finalStatus: "IN_PROCESS",
    });

    // 🟢 Active = Assigned to associate & still in process
    const activeLeads = await Enquiry.countDocuments({
      assignedTo: { $ne: null },
      finalStatus: "IN_PROCESS",
    });

    const convertedLeads = await Enquiry.countDocuments({
      finalStatus: "CONVERTED",
    });

    const notInterestedLeads = await Enquiry.countDocuments({
      finalStatus: "NOT_INTERESTED",
    });

    res.status(200).json({
      totalUsers,
      totalLeads,
      pendingLeads,
      activeLeads,
      convertedLeads,
      notInterestedLeads,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ message: "Dashboard summary error" });
  }
};

// -----------------------------------------
// 👤 GET LOGGED IN USER (ME)
// -----------------------------------------
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    res.json({
      success: true,
      user: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || "",
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


