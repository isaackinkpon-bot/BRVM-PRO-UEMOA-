const crypto = require("crypto");
const { getProduct } = require("./_lib/products");
const { AppError, getConfig, fedaRequest, unwrap, sendError } = require("./_lib/fedapay");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

function cleanCustomer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const c = {};
  const txt = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  const firstname = txt(raw.firstname, 80);
  const lastname = txt(raw.lastname, 80);
  const email = txt(raw.email, 120);
  if (firstname) c.firstname = firstname;
  if (lastname) c.lastname = lastname;
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) c.email = email;

  const phone = raw.phone;
  if (phone && typeof phone === "object") {
    const number = String(phone.number || "").replace(/\D/g, "");
    const country = String(phone.country || "").trim().toLowerCase();
    if (number.length >= 6 && number.length <= 15 && /^[a-z]{2}$/.test(country)) {
      c.phone_number = { number, country };
    }
  }
  return Object.keys(c).length ? c : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw new AppError(405, "Méthode non autorisée.");
    }

    const body = readBody(req);

    const productId = body.product;
    const product = getProduct(productId);
    if (!product) throw new AppError(400, "Produit inconnu.");

    const cfg = getConfig();

    const orderKey = crypto.randomBytes(24).toString("hex");

    const payload = {
      description: `Achat ${product.name}`,
      amount: product.price,
      currency: { iso: "XOF" },
      callback_url: `${cfg.siteUrl}/payment-return?k=${orderKey}`,
      custom_metadata: { product: productId, order_key: orderKey },
    };
    const customer = cleanCustomer(body.customer);
    if (customer) payload.customer = customer;

    const created = unwrap(await fedaRequest(cfg, "POST", "/transactions", payload), "transaction");
    if (!created || created.id === undefined || created.id === null) {
      throw new AppError(502, "Impossible de créer le paiement.", `transaction non créée : ${JSON.stringify(created)}`);
    }
    const transactionId = String(created.id);

    const tokenData = await fedaRequest(cfg, "POST", `/transactions/${transactionId}/token`);
    const url = tokenData && (tokenData.url || (tokenData["v1/token"] && tokenData["v1/token"].url));
    if (!url || !/^https:\/\//.test(url)) {
      throw new AppError(502, "Impossible de créer le paiement.", `lien de paiement absent pour la transaction ${transactionId}`);
    }

    return res.status(200).json({
      success: true,
      transactionId,
      paymentUrl: url,
      orderKey,
    });
  } catch (err) {
    return sendError(res, err);
  }
};
