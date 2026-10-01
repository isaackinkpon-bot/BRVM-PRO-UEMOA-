const { AppError, getConfig, getVerifiedOrder, sendError } = require("./_lib/fedapay");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      throw new AppError(405, "Méthode non autorisée.");
    }

    const { id, k } = req.query || {};
    const cfg = getConfig();
    const order = await getVerifiedOrder(cfg, id, k);

    const out = {
      success: true,
      status: order.status,
      productName: order.product.name,
    };
    if (order.status === "paid") {
      out.downloadUrl = `/api/download?id=${encodeURIComponent(order.transactionId)}&k=${encodeURIComponent(k)}`;
    }
    return res.status(200).json(out);
  } catch (err) {
    return sendError(res, err);
  }
};
