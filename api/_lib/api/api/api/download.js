const fs = require("fs");
const path = require("path");
const { AppError, getConfig, getVerifiedOrder, sendError } = require("./_lib/fedapay");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      throw new AppError(405, "Méthode non autorisée.");
    }

    const { id, k } = req.query || {};
    const cfg = getConfig();
    const order = await getVerifiedOrder(cfg, id, k);

    if (order.status !== "paid") {
      throw new AppError(402, "Paiement non confirmé.", `téléchargement refusé, statut ${order.rawStatus}`);
    }

    const filePath = path.join(process.cwd(), "private", order.product.file);
    let pdf;
    try {
      pdf = fs.readFileSync(filePath);
    } catch (err) {
      throw new AppError(500, "Le document est momentanément indisponible. Contactez le support.", `PDF introuvable : ${filePath}`);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${order.product.file}"`);
    res.setHeader("Content-Length", pdf.length);
    return res.status(200).send(pdf);
  } catch (err) {
    return sendError(res, err);
  }
};
