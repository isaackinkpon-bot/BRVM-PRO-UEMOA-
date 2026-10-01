async function buyProduct(productId, button, customer) {
  const label = button ? button.textContent : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Redirection…";
  }

  try {
    const body = { product: productId };
    if (customer) body.customer = customer;

    const response = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Impossible de créer le paiement.");
    }

    try {
      localStorage.setItem(
        "brvm_order",
        JSON.stringify({ id: data.transactionId, k: data.orderKey, product: productId })
      );
    } catch (_) {}

    window.location.href = data.paymentUrl;
  } catch (err) {
    alert(err.message || "Impossible de créer le paiement.");
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
                        }
