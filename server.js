const express = require("express");
const app = express();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const path = require("path");
const axios = require("axios");

app.use(express.json());

/* =========================
   APPLE PAY DOMAIN FILE
========================= */
app.use(
  "/.well-known",
  express.static(path.join(__dirname, ".well-known"))
);

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

app.get("/success-upsell", (req, res) => {
  res.sendFile(path.join(__dirname, "success-upsell.html"));
});

/* =========================
   PAYMENT ROUTE
========================= */

app.post("/pay", async (req, res) => {
  try {
    const { paymentMethodId, name, email, addWorkbook } = req.body;

    if (!paymentMethodId || !email) {
      return res.json({
        success: false,
        error: "Missing payment data",
      });
    }

    /* ========= STRIPE ========= */

    const amount = addWorkbook ? 4700 : 3700;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      receipt_email: email,
      description: addWorkbook
        ? "Freedom Offer Formula + Workbook"
        : "Freedom Offer Formula",
    });

    if (paymentIntent.status !== "succeeded") {
      return res.json({
        success: false,
        error: "Payment not completed",
      });
    }

    /* ========= ACTIVECAMPAIGN ========= */
    // non blocking (حتى لو فشل ما يكسر الدفع)

    try {
      const contactResponse = await axios.post(
        "https://dinashakir.api-us1.com/api/3/contact/sync",
        {
          contact: {
            email,
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

      if (addWorkbook) {
        await axios.post(
          "https://dinashakir.api-us1.com/api/3/contactTags",
          {
            contactTag: {
              contact: contactId,
              tag: "5",
            },
          },
          {
            headers: {
              "Api-Token": process.env.ACTIVE_CAMPAIGN_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Upsell Tag added");
      }

    } catch (acError) {
      console.error(
        "ActiveCampaign error:",
        acError.response?.data || acError.message
      );
    }

    /* ========= SUCCESS ========= */

    return res.json({
      success: true,
      redirect: addWorkbook
        ? "/success-upsell"
        : "/success",
    });

  } catch (err) {
    console.error("PAYMENT ERROR:", err.message);

    return res.json({
      success: false,
      error: "Server error",
    });
  }
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
