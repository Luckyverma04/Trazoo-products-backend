import Enquiry from "../models/enquiry.model.js";
import sendEmail, { ADMIN_EMAIL } from "../utils/sendEmail.js";
import csv from "csv-parser";
import fs from "fs";

// ================= EMAIL =================
const sendUserEmail = async (email, name) => {
  await sendEmail({
    to: email,
    subject: "Your Enquiry Has Been Received",
    html: `<p>Hello ${name}, we received your enquiry.</p>`,
  });
};
// ================= ADMIN ENQUIRY EMAIL =================
const sendAdminEnquiryEmail = async (enquiry) => {
  const adminUrl = `https://trazooglobal.com/admin/lead/${enquiry._id}`;

  await sendEmail({
    to: ADMIN_EMAIL,
    replyTo: enquiry.email || undefined,
    subject: `🚨 New Enquiry - ${enquiry.fullName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto;">

        <h2 style="color:#DF4607;">
          🚨 New Trazoo Enquiry
        </h2>

        <p>
          A new requirement has been submitted from the website.
        </p>

        <hr />

        <h3>Customer Details</h3>

        <p>
          <strong>Name:</strong> ${enquiry.fullName}
        </p>

        <p>
          <strong>Company:</strong> ${enquiry.company || "Not provided"}
        </p>

        <p>
          <strong>Email:</strong> ${enquiry.email || "Not provided"}
        </p>

        <p>
          <strong>Phone:</strong> ${enquiry.phone || "Not provided"}
        </p>

        <p>
          <strong>Location:</strong> ${enquiry.location || "Not provided"}
        </p>

        <h3>Requirement</h3>

        <p>
          ${enquiry.requirement || enquiry.lookingFor || "Not provided"}
        </p>

        <p>
          <strong>Quantity:</strong>
          ${enquiry.quantity || "Not provided"}
        </p>

        <p>
          <strong>Required By:</strong>
          ${
            enquiry.requiredBy
              ? new Date(enquiry.requiredBy).toLocaleDateString("en-IN")
              : "Not provided"
          }
        </p>

        <br />

        <a
          href="${adminUrl}"
          style="
            display:inline-block;
            background:#DF4607;
            color:#ffffff;
            text-decoration:none;
            padding:14px 24px;
            border-radius:6px;
            font-weight:bold;
          "
        >
          View Enquiry
        </a>

        <br /><br />

        <p style="color:#777;font-size:13px;">
          Enquiry ID: ${enquiry._id}
        </p>

      </div>
    `,
  });
};

// ================= WEBSITE ENQUIRY =================
export const createEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.create({
      ...req.body,
      leadSource: "WEBSITE",
      status: "PENDING",
    });

    // Response immediately
    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      enquiryId: enquiry._id,
    });

    // Customer confirmation email
    if (enquiry.email) {
      sendUserEmail(enquiry.email, enquiry.fullName)
        .catch((err) =>
          console.error("Customer email failed:", err.message)
        );
    }

    // Admin notification email
    sendAdminEnquiryEmail(enquiry)
      .catch((err) =>
        console.error("Admin enquiry email failed:", err.message)
      );

  } catch (error) {
    console.error("Create enquiry error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ================= ADMIN MANUAL LEAD =================
export const createManualLead = async (req, res) => {
  try {
    const lead = await Enquiry.create({
      ...req.body,
      leadSource: "SELF",
      status: "ACTIVE",
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET ALL ENQUIRIES (PAGINATED) - 🔥 FIXED VERSION =================
export const getAllEnquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const assigned = req.query.assigned || "";

    const skip = (page - 1) * limit;
    const query = {};

    // 🔍 Search by name, email, phone, company
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    // 🔥 THIS IS THE MAIN FIX - Filter by assigned status
    if (assigned === "yes") query.assignedTo = { $ne: null };
    if (assigned === "no") query.assignedTo = null;

    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "name email")
      .select("-communications -history")
      .lean();

    const total = await Enquiry.countDocuments(query);

    res.status(200).json({
      success: true,
      enquiries,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET BY ID =================
export const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).populate("assignedTo", "name email role");
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.status(200).json({ success: true, enquiry });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= ASSOCIATE UPDATE =================
export const updateLeadStatus = async (req, res) => {
  try {
    const { callStatus, subStatus, finalStatus, comment } = req.body;

    const lead = await Enquiry.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (callStatus) lead.callStatus = callStatus;
    if (subStatus) lead.subStatus = subStatus;
    if (finalStatus) lead.finalStatus = finalStatus;

    lead.history.push({
      action: "STATUS_UPDATE",
      comment,
      by: req.user?.id || null,
    });

    await lead.save();

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ADMIN ASSIGN LEAD =================
export const assignLeadToAssociate = async (req, res) => {
  try {
    const { associateId } = req.body;

    const lead = await Enquiry.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    lead.assignedTo = associateId;
    lead.status = "ACTIVE";

    lead.history.push({
      action: "LEAD_ASSIGNED",
      comment: "Lead assigned to associate",
      by: req.user?.id || null,
    });

    await lead.save();

    res.status(200).json({
      success: true,
      message: "Lead assigned successfully",
      lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET MY LEADS (TOKEN BASED) =================
export const getMyLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const leads = await Enquiry.find({ assignedTo: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-communications -history")
      .lean();

    const total = await Enquiry.countDocuments({ assignedTo: req.user._id });

    res.status(200).json({
      success: true,
      leads,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= UPLOAD CSV =================
export const uploadLeadsCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const leads = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        const lead = {
          fullName: row.name?.trim() || "",
          phone: row.mobile?.trim() || "",
          email: row.email?.trim().toLowerCase() || "",
          company: row.company?.trim() || "",
          location: row.city?.trim() || row.State?.trim() || "",
          lookingFor: row.category?.trim() || "",
          leadSource: "SELF",
          status: "ACTIVE",
        };

        if (lead.fullName || lead.phone) {
          leads.push(lead);
        }
      })
      .on("end", async () => {
        if (leads.length === 0) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "CSV processed but no usable data found",
          });
        }

        await Enquiry.insertMany(leads, { ordered: false });
        fs.unlinkSync(req.file.path);

        res.status(201).json({
          success: true,
          message: "CSV uploaded successfully",
          inserted: leads.length,
        });
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DASHBOARD SUMMARY =================
export const dashboardSummary = async (req, res) => {
  try {
    const total = await Enquiry.countDocuments();

    const pending = await Enquiry.countDocuments({
      assignedTo: null,
      finalStatus: "IN_PROCESS",
    });

    const active = await Enquiry.countDocuments({
      assignedTo: { $ne: null },
      finalStatus: "IN_PROCESS",
    });

    const converted = await Enquiry.countDocuments({
      finalStatus: "CONVERTED",
    });

    const notInterested = await Enquiry.countDocuments({
      finalStatus: "NOT_INTERESTED",
    });

    res.status(200).json({
      success: true,
      summary: {
        total,
        pending,
        active,
        converted,
        notInterested,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ADD COMMUNICATION =================
export const addCommunication = async (req, res) => {
  try {
    const { type, message } = req.body;

    const lead = await Enquiry.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    lead.communications.push({
      type,
      message,
      sentBy: req.user._id,
    });

    await lead.save();

    res.status(200).json({
      success: true,
      message: "Communication logged successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET COMMUNICATION =================
export const getCommunications = async (req, res) => {
  try {
    const lead = await Enquiry.findById(req.params.id).populate(
      "communications.sentBy",
      "name email"
    );

    res.status(200).json({
      success: true,
      communications: lead.communications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ADMIN BULK ASSIGN LEADS =================
export const assignBulkLeads = async (req, res) => {
  try {
    const { leadIds, associateId } = req.body;

    if (!leadIds || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No leads selected",
      });
    }

    if (!associateId) {
      return res.status(400).json({
        success: false,
        message: "Associate is required",
      });
    }

    const result = await Enquiry.updateMany(
      { _id: { $in: leadIds } },
      {
        $set: {
          assignedTo: associateId,
          status: "ACTIVE",
        },
        $push: {
          history: {
            action: "BULK_LEAD_ASSIGNED",
            comment: `Bulk assigned ${leadIds.length} leads`,
            by: req.user?._id || null,
          },
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Leads assigned successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};