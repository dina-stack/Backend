const express = require("express");
const app = express();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const path = require("path");
const axios = require("axios");

app.use(express.json());

/* =========================
   ROUTES
========================= */

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// صفحة النجاح
app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

// الدفع
app.post("/pay", async (req, res) => {
  try {
    const { paymentMethodId, name, email } = req.body;

    // 1️⃣ Stripe Payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 3700, // $37.00
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      receipt_email: email,
      description: "Freedom Offer Formula",
      return_url: "https://proactive-clarity-production.up.railway.app/success",
    });

    if (paymentIntent.status !== "succeeded") {
      return res.json({ success: false, error: "Payment not completed." });
    }

    // 2️⃣ Create / Update contact in ActiveCampaign
    const contactResponse = await axios.post(
      "https://dinashakir.api-us1.com/api/3/contact/sync",
      {
        contact: {
          email: email,
          firstName: name,
        },
      },
      {
        headers: {
          "Api-Token": process.env.ACTIVE_CAMPAIGN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const contactId = contactResponse.data.contact.id;

    // 3️⃣ Add contact to List ID = 15
    await axios.post(
      "https://dinashakir.api-us1.com/api/3/contactLists",
      {
        contactList: {
          list: 15,
          contact: contactId,
          status: 1,
        },
      },
      {
        headers: {
          "Api-Token": process.env.ACTIVE_CAMPAIGN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    // 4️⃣ Success
    res.json({ success: true });
    return;

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.json({ success: false, error: err.message });
  }
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
