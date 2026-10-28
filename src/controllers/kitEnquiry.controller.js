import KitEnquiry from "../models/KitEnquiry.model.js";
import Product from "../models/product.model.js";
import sendEmail, { ADMIN_EMAIL } from "../utils/sendEmail.js";

/* ================================================
   CREATE KIT ENQUIRY  —  POST /kit-enquiry
   (unchanged)
================================================ */
export const createKitEnquiry = async (req, res) => {
  try {
    const { name, email, phone, budget, quantity, selectedProducts, brandLogo } = req.body;

    if (!budget || !quantity || !selectedProducts?.length) {
      return res.status(400).json({ message: "Budget, quantity and product selection are required" });
    }
    if (quantity < 20) {
      return res.status(400).json({ message: "Minimum order quantity is 20 units" });
    }

    let perKitPrice = 0;
    const productDetails = [];

    for (const item of selectedProducts) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: "One or more selected products not found" });
      }
      if (product.customBrandingMOQ && quantity < product.customBrandingMOQ) {
        return res.status(400).json({
          message: `${product.name} requires minimum order of ${product.customBrandingMOQ}`,
        });
      }
      perKitPrice += product.unitPrice;
      if (product.brandingSupported) {
        perKitPrice += product.brandingPrice || 0;
      }

      // Save product name + price for email
      productDetails.push({
        name: product.name,
        unitPrice: product.unitPrice,
        brandingPrice: product.brandingSupported ? (product.brandingPrice || 0) : 0,
      });
    }

    const totalPrice = perKitPrice * quantity;

    const enquiry = await KitEnquiry.create({
      name,
      email,
      phone,
      budget,
      quantity,
      selectedProducts,
      brandLogo,
      perKitPrice,
      totalPrice,
      gstApplicable: true,
      requestType: "kit",
      status: "new",
      history: [{ action: "Enquiry created", comment: "Submitted via kit builder" }],
    });

    // ── Build product rows for email ──
    const productRows = productDetails.map((p) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${p.name}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">₹${p.unitPrice}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">₹${p.brandingPrice}</td>
      </tr>
    `).join("");

    // ── Admin Notification Email (background — a mail failure must not fail the enquiry) ──
    sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email || undefined,
      subject: `🚀 New Kit Enquiry — ${name}`,
      html: `
        <h2 style="color:#e65c00;font-family:sans-serif">New Gift Kit Enquiry Received</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Name</b></td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Email</b></td><td style="padding:8px;border:1px solid #ddd">${email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Phone</b></td><td style="padding:8px;border:1px solid #ddd">${phone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Budget</b></td><td style="padding:8px;border:1px solid #ddd">₹${budget}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Quantity</b></td><td style="padding:8px;border:1px solid #ddd">${quantity} units</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Per Kit Price</b></td><td style="padding:8px;border:1px solid #ddd">₹${perKitPrice}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Total Price</b></td><td style="padding:8px;border:1px solid #ddd">₹${totalPrice} + GST</td></tr>
        </table>

        <h3 style="font-family:sans-serif;margin-top:20px">Selected Products</h3>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr style="background:#f5f5f5">
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th>
            <th style="padding:8px;border:1px solid #ddd">Unit Price</th>
            <th style="padding:8px;border:1px solid #ddd">Branding Price</th>
          </tr>
          ${productRows}
        </table>

        <p style="font-family:sans-serif;margin-top:20px;color:#888">Enquiry ID: ${enquiry._id}</p>
      `,
    }).catch(() => {});

    // ── Customer Confirmation Email ──
    if (email) sendEmail({
      to: email,
      subject: `🎁 Your Gift Kit Enquiry Received — Trazoo`,
      html: `
        <h2 style="color:#e65c00;font-family:sans-serif">Thank you, ${name}!</h2>
        <p style="font-family:sans-serif">Your custom gift kit enquiry has been received successfully.</p>

        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Quantity</b></td><td style="padding:8px;border:1px solid #ddd">${quantity} units</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Per Kit Price</b></td><td style="padding:8px;border:1px solid #ddd">₹${perKitPrice}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Total Price</b></td><td style="padding:8px;border:1px solid #ddd">₹${totalPrice} + GST</td></tr>
        </table>

        <h3 style="font-family:sans-serif;margin-top:20px">Your Selected Products</h3>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr style="background:#f5f5f5">
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th>
            <th style="padding:8px;border:1px solid #ddd">Unit Price</th>
            <th style="padding:8px;border:1px solid #ddd">Branding Price</th>
          </tr>
          ${productRows}
        </table>

        <p style="font-family:sans-serif;margin-top:16px">Our team will contact you within <b>24 hours</b>.</p>
        <br/>
        <p style="font-family:sans-serif;color:#888">Team Trazoo Global</p>
      `,
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Your gift kit enquiry has been submitted successfully",
      enquiryId: enquiry._id,
      pricing: {
        perKitPrice,
        totalPrice,
        note: "GST will be applicable separately",
      },
    });
  } catch (error) {
    console.error("Kit Enquiry Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

/* ================================================
   CREATE CUSTOMIZATION ENQUIRY  —  POST /kit-enquiry/customization
   NEW — no budget/pricing step. User picks ONE product, says what kind
   of customization they want, optionally attaches a logo (URL, already
   uploaded the same way brandLogo is on the kit-builder) and/or a
   reference image, plus free-text notes.
================================================ */
export const createCustomizationEnquiry = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      productId,
      category,
      price,
      quantity,
      customizationType,
      notes,
      needsLogo,
      brandLogo,
      referenceImage,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }
    if (!productId) {
      return res.status(400).json({ message: "Please select a product to customize" });
    }
    if (!customizationType) {
      return res.status(400).json({ message: "Please specify the type of customization required" });
    }
    if (needsLogo && !brandLogo) {
      return res.status(400).json({ message: "Please upload your logo" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Selected product not found" });
    }

    const enquiry = await KitEnquiry.create({
      name,
      email,
      phone,
      quantity: quantity || undefined,
      selectedProducts: [
        {
          productId: product._id,
          category: category || product.category,
          price: price ?? product.unitPrice,
        },
      ],
      customizationType,
      notes,
      needsLogo: !!needsLogo,
      brandLogo,
      referenceImage,
      requestType: "customization",
      status: "new",
      history: [{ action: "Enquiry created", comment: "Submitted via customization page" }],
    });

    // ── Admin Notification Email (background — a mail failure must not fail the enquiry) ──
    sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email || undefined,
      subject: `🎨 New Customization Request — ${name}`,
      html: `
        <h2 style="color:#e65c00;font-family:sans-serif">New Customization Request</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Name</b></td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Email</b></td><td style="padding:8px;border:1px solid #ddd">${email || "Not provided"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Phone</b></td><td style="padding:8px;border:1px solid #ddd">${phone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Product</b></td><td style="padding:8px;border:1px solid #ddd">${product.name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Customization Type</b></td><td style="padding:8px;border:1px solid #ddd">${customizationType}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Needs Logo</b></td><td style="padding:8px;border:1px solid #ddd">${needsLogo ? "Yes" : "No"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><b>Notes</b></td><td style="padding:8px;border:1px solid #ddd">${notes || "—"}</td></tr>
        </table>
        <p style="font-family:sans-serif;margin-top:20px;color:#888">Enquiry ID: ${enquiry._id}</p>
      `,
    }).catch(() => {});

    // ── Customer Confirmation Email (skip if no email given) ──
    if (email) {
      sendEmail({
        to: email,
        subject: `Your Customization Request Received — Trazoo`,
        html: `
          <h2 style="color:#e65c00;font-family:sans-serif">Thank you, ${name}!</h2>
          <p style="font-family:sans-serif">We've received your request to customize <b>${product.name}</b>.</p>
          <p style="font-family:sans-serif">Our team will review it and contact you within <b>24 hours</b> with a quote.</p>
          <br/>
          <p style="font-family:sans-serif;color:#888">Team Trazoo Global</p>
        `,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: "Your customization request has been submitted successfully",
      enquiryId: enquiry._id,
    });
  } catch (error) {
    console.error("Customization Enquiry Error:", error);
    res.status(500).json({ message: error.message || "Something went wrong" });
  }
};

/* ================================================
   GET ALL KIT ENQUIRIES  —  GET /kit-enquiry
   (unchanged, optional ?requestType=kit|customization filter added)
================================================ */
export const getAllKitEnquiries = async (req, res) => {
  try {
    const { requestType } = req.query;
    const query = requestType ? { requestType } : {};

    const enquiries = await KitEnquiry.find(query)
      .populate("selectedProducts.productId")
      .sort({ createdAt: -1 });

    res.json(enquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================================================
   GET SINGLE KIT ENQUIRY  —  GET /kit-enquiry/:id
   (unchanged)
================================================ */
export const getKitEnquiryById = async (req, res) => {
  try {
    const enquiry = await KitEnquiry.findById(req.params.id)
      .populate("selectedProducts.productId");

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.json(enquiry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================================================
   UPDATE STATUS  —  PATCH /kit-enquiry/:id/status
   (unchanged)
================================================ */
export const updateKitEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const allowedStatuses = [
      "new", "contacted", "quoted", "won", "lost",
      "pending", "completed", "cancelled",
      "PENDING", "ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status: ${status}` });
    }

    const enquiry = await KitEnquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    const oldStatus = enquiry.status;
    enquiry.status = status;
    enquiry.history.push({
      action: `Status changed: ${oldStatus} → ${status}`,
      comment: "",
    });

    await enquiry.save();

    res.json({
      success: true,
      message: `Enquiry status updated to ${status}`,
      enquiry,
    });
  } catch (error) {
    console.error("updateKitEnquiryStatus error:", error);
    res.status(500).json({ message: error.message });
  }
};