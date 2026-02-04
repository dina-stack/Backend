const express = require("express");
const app = express();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const path = require("path");
const axios = require("axios");

app.use(express.json());

/* =========================
   🔹 APPLE PAY DOMAIN FILE
   (هاي الإضافة الجديدة)
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

app.post("/pay", async (req, res) => {
  try {
    const { paymentMethodId, name, email, addWorkbook } = req.body;

    if (!paymentMethodId || !email) {
      return res.json({
        success: false,
        error: "Missing payment data",
      });
    }

    /* =========================
       STRIPE PAYMENT
    ========================= */
    let amount = 3700;

    if (addWorkbook === true) {
     amount = 4700;
  }


    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",

      payment_method: paymentMethodId,
      confirm: true,

      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },

      receipt_email: email,
      description: "Freedom Offer Formula",
    });

    if (paymentIntent.status !== "succeeded") {
      return res.json({
        success: false,
        error: "Payment not completed",
        status: paymentIntent.status,
      });
    }

    /* =========================
       ACTIVECAMPAIGN (NON BLOCKING)
    ========================= */

    try {
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
    } catch (acError) {
      console.error(
        "ActiveCampaign error:",
        acError.response?.data || acError.message
      );
    }

    if (addWorkbook === true) {
  res.json({
    success: true,
    redirect: "/success-upsell"
  });
} else {
  res.json({
    success: true,
    redirect: "/success"
  });
}
  } catch (err) {
    console.error("PAYMENT ERROR:", err.message);
    res.json({
      success: false,
      error: err.message,
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

