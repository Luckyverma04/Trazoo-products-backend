import ProposalRequest from "../models/proposalRequest.model.js";
import sendEmail, { ADMIN_EMAIL } from "../utils/sendEmail.js";

/* ================================================
   CREATE PROPOSAL REQUEST  —  POST /api/proposal-requests
================================================ */
export const createProposalRequest = async (req, res) => {
  try {
    const { name, company, email, phone, programme, qty, deadline, brief } = req.body;

    if (!name || !phone || !email) {
      return res.status(400).json({ message: "Name, email and phone are required" });
    }

    const request = await ProposalRequest.create({
      name,
      company,
      email,
      phone,
      programme,
      qty: qty || null,
      deadline: deadline || null,
      brief,
    });

    // Respond immediately — don't make the customer wait on SMTP
    res.status(201).json({
      success: true,
      message: "Requirement received",
      requestId: request._id,
    });

    // Admin notification email (background, doesn't block the response)
    sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `🚀 New Proposal Request — ${name}`,
      html: `
        <h2 style="color:#DF4607;font-family:sans-serif">New Proposal Request</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Name</b></td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Company</b></td><td style="padding:8px;border:1px solid #ddd">${company || "Not provided"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Email</b></td><td style="padding:8px;border:1px solid #ddd">${email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Phone</b></td><td style="padding:8px;border:1px solid #ddd">${phone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Programme</b></td><td style="padding:8px;border:1px solid #ddd">${programme || "Not provided"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Quantity</b></td><td style="padding:8px;border:1px solid #ddd">${qty || "Not provided"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Needed by</b></td><td style="padding:8px;border:1px solid #ddd">${deadline || "Not provided"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Brief</b></td><td style="padding:8px;border:1px solid #ddd">${brief || "Not provided"}</td></tr>
        </table>
        <p style="font-family:sans-serif;margin-top:20px;color:#888">Request ID: ${request._id}</p>
      `,
    }).catch(() => {});

    // Customer confirmation email (background, doesn't block the response)
    sendEmail({
      to: email,
      subject: "We've received your requirement — Trazoo",
      html: `
        <h2 style="color:#DF4607;font-family:sans-serif">Thank you, ${name}!</h2>
        <p style="font-family:sans-serif">We've received your requirement and will be in touch within 1 working day.</p>
        <br/>
        <p style="font-family:sans-serif;color:#888">Team Trazoo Global</p>
      `,
    }).catch(() => {});
  } catch (error) {
    console.error("Create proposal request error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

/* ================================================
   GET ALL PROPOSAL REQUESTS  —  GET /api/proposal-requests
================================================ */
export const getAllProposalRequests = async (req, res) => {
  try {
    const requests = await ProposalRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};