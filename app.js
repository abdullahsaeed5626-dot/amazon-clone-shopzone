const CART_KEY = "shopzone_cart_v1";
const ORDERS_KEY = "shopzone_orders_v1";

let cart = loadStorage(CART_KEY, []);
let orders = loadStorage(ORDERS_KEY, []);

const state = {
  search: "",
  category: "all",
  price: "all",
  sort: "featured"
};

const productGrid = document.getElementById("productGrid");
const emptyProducts = document.getElementById("emptyProducts");
const resultsText = document.getElementById("resultsText");
const cartCount = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItems = document.getElementById("cartItems");
const cartSummary = document.getElementById("cartSummary");
const checkoutModal = document.getElementById("checkoutModal");
const checkoutSummary = document.getElementById("checkoutSummary");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutError = document.getElementById("checkoutError");
const productModal = document.getElementById("productModal");
const productModalContent = document.getElementById("productModalContent");
const ordersModal = document.getElementById("ordersModal");
const ordersContent = document.getElementById("ordersContent");
const toast = document.getElementById("toast");

function loadStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0
  }).format(value).replace("PKR", "Rs.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProduct(id) {
  return PRODUCTS.find(product => product.id === Number(id));
}

function getFilteredProducts() {
  let list = PRODUCTS.filter(product => {
    const matchesSearch =
      product.title.toLowerCase().includes(state.search.toLowerCase()) ||
      product.category.toLowerCase().includes(state.search.toLowerCase());

    const matchesCategory =
      state.category === "all" || product.category === state.category;

    let matchesPrice = true;
    if (state.price !== "all") {
      const [min, max] = state.price.split("-").map(Number);
      matchesPrice = product.price >= min && product.price <= max;
    }

    return matchesSearch && matchesCategory && matchesPrice;
  });

  switch (state.sort) {
    case "price-low":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      list.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "name":
      list.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  return list;
}

function renderProducts() {
  const products = getFilteredProducts();

  resultsText.textContent = `Showing ${products.length} of ${PRODUCTS.length} products`;
  productGrid.innerHTML = products.map(productCardTemplate).join("");

  const hasProducts = products.length > 0;
  productGrid.classList.toggle("hidden", !hasProducts);
  emptyProducts.classList.toggle("hidden", hasProducts);
}

function productCardTemplate(product) {
  return `
    <article class="product-card">
      <div class="product-image-wrap">
        <span class="discount-badge">${escapeHtml(product.badge)}</span>
        <img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy">
      </div>
      <div class="product-info">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3 class="product-title" data-view-product="${product.id}">${escapeHtml(product.title)}</h3>
        <div class="rating">★ ${product.rating} <span>(${product.reviews.toLocaleString()})</span></div>
        <div class="price-row">
          <span class="price">${money(product.price)}</span>
          <span class="old-price">${money(product.oldPrice)}</span>
        </div>
        <div class="stock">${product.stock <= 10 ? "Only " + product.stock + " left" : "In stock"}</div>
        <div class="product-actions">
          <button class="add-cart" data-add-cart="${product.id}" type="button">Add to cart</button>
          <button class="view-product" data-view-product="${product.id}" type="button" aria-label="View product">↗</button>
        </div>
      </div>
    </article>
  `;
}

function addToCart(id) {
  const product = getProduct(id);
  if (!product) return;

  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast("You have reached the available stock limit.");
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ id: product.id, quantity: 1 });
  }

  saveStorage(CART_KEY, cart);
  renderCart();
  updateCartCount();
  showToast(`${product.title} added to cart.`, true);
}

function updateCartQuantity(id, change) {
  const item = cart.find(cartItem => cartItem.id === Number(id));
  const product = getProduct(id);
  if (!item || !product) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(cartItem => cartItem.id !== Number(id));
  } else if (item.quantity > product.stock) {
    item.quantity = product.stock;
    showToast("Maximum available stock reached.");
  }

  saveStorage(CART_KEY, cart);
  renderCart();
  updateCartCount();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== Number(id));
  saveStorage(CART_KEY, cart);
  renderCart();
  updateCartCount();
  showToast("Item removed from cart.");
}

function getCartDetails() {
  return cart
    .map(item => {
      const product = getProduct(item.id);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter(Boolean);
}

function calculateTotals() {
  const items = getCartDetails();
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal === 0 ? 0 : subtotal >= 15000 ? 0 : 350;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shipping + tax;

  return { subtotal, shipping, tax, total };
}

function renderCart() {
  const items = getCartDetails();
  const totals = calculateTotals();

  if (!items.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Add products to your cart and they will appear here.</p>
      </div>
    `;
    cartSummary.innerHTML = "";
    return;
  }

  cartItems.innerHTML = items.map(({ product, quantity }) => `
    <div class="cart-item">
      <div class="cart-item-image">
        <img src="${product.image}" alt="${escapeHtml(product.title)}">
      </div>
      <div>
        <p class="cart-item-title">${escapeHtml(product.title)}</p>
        <div class="cart-item-price">${money(product.price)}</div>
        <div class="quantity-control">
          <button type="button" data-quantity="${product.id}" data-change="-1">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${product.id}" data-change="1">+</button>
        </div>
        <button class="remove-item" data-remove-cart="${product.id}" type="button">Remove</button>
      </div>
      <div class="cart-line-total">${money(product.price * quantity)}</div>
    </div>
  `).join("");

  cartSummary.innerHTML = `
    <div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>
    <div class="summary-row"><span>Shipping</span><strong>${totals.shipping ? money(totals.shipping) : "FREE"}</strong></div>
    <div class="summary-row"><span>Tax (5%)</span><strong>${money(totals.tax)}</strong></div>
    ${totals.shipping === 0 ? '<div class="free-shipping">✓ You qualified for free shipping.</div>' : '<div class="free-shipping">Add Rs. ' + money(15000 - totals.subtotal).replace("Rs.", "") + ' more for free shipping.</div>'}
    <div class="summary-row total"><span>Total</span><strong>${money(totals.total)}</strong></div>
    <button class="primary-button checkout-button" id="openCheckoutBtn" type="button">Proceed to checkout</button>
  `;
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
}

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function openProduct(id) {
  const product = getProduct(id);
  if (!product) return;

  productModalContent.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">
        <img src="${product.image}" alt="${escapeHtml(product.title)}">
      </div>
      <div>
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h2>${escapeHtml(product.title)}</h2>
        <div class="rating">★ ${product.rating} <span>(${product.reviews.toLocaleString()} reviews)</span></div>
        <div class="price-row">
          <span class="price">${money(product.price)}</span>
          <span class="old-price">${money(product.oldPrice)}</span>
        </div>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <ul class="detail-list">${product.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
        <div class="stock">${product.stock <= 10 ? "Only " + product.stock + " left in stock." : "In stock and ready to ship."}</div>
        <div class="detail-actions">
          <button class="primary-button" data-add-cart="${product.id}" type="button">Add to cart</button>
          <button class="secondary-button" data-close="productModal" type="button">Close</button>
        </div>
      </div>
    </div>
  `;

  productModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.classList.add("hidden");
  if (cartDrawer.classList.contains("open")) return;
  document.body.style.overflow = "";
}

function openCheckout() {
  if (!cart.length) {
    showToast("Your cart is empty.");
    return;
  }

  closeCart();
  renderCheckoutSummary();
  checkoutError.classList.add("hidden");
  checkoutModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function renderCheckoutSummary() {
  const items = getCartDetails();
  const totals = calculateTotals();

  checkoutSummary.innerHTML = `
    <h3>Order summary</h3>
    ${items.map(({ product, quantity }) => `
      <div class="mini-order-item">
        <img src="${product.image}" alt="">
        <div>${escapeHtml(product.title)}<br><small>Qty: ${quantity}</small></div>
        <strong>${money(product.price * quantity)}</strong>
      </div>
    `).join("")}
    <div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>
    <div class="summary-row"><span>Shipping</span><strong>${totals.shipping ? money(totals.shipping) : "FREE"}</strong></div>
    <div class="summary-row"><span>Tax</span><strong>${money(totals.tax)}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>${money(totals.total)}</strong></div>
  `;
}

function placeOrder(event) {
  event.preventDefault();

  if (!cart.length) {
    showCheckoutError("Your cart is empty.");
    return;
  }

  const formData = new FormData(checkoutForm);
  const customer = Object.fromEntries(formData.entries());
  const totals = calculateTotals();
  const items = getCartDetails();

  const order = {
    orderId: `SZ-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    status: "Order placed",
    customer,
    items: items.map(({ product, quantity }) => ({
      id: product.id,
      title: product.title,
      quantity,
      unitPrice: product.price,
      lineTotal: product.price * quantity
    })),
    totals
  };

  orders.unshift(order);
  saveStorage(ORDERS_KEY, orders);

  cart = [];
  saveStorage(CART_KEY, cart);
  renderCart();
  updateCartCount();

  checkoutForm.reset();
  checkoutModal.classList.add("hidden");
  document.body.style.overflow = "";

  showOrderSuccess(order);
}

function showOrderSuccess(order) {
  productModalContent.innerHTML = `
    <div class="success-screen" style="text-align:center;padding:35px 10px;">
      <div style="font-size:55px;">✓</div>
      <p class="eyebrow">ORDER CONFIRMED</p>
      <h2>Thank you, ${escapeHtml(order.customer.fullName)}!</h2>
      <p>Your order <strong>${escapeHtml(order.orderId)}</strong> has been saved locally.</p>
      <p style="color:#66727f;font-size:12px;">Total: <strong>${money(order.totals.total)}</strong> · ${escapeHtml(order.customer.payment)}</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
        <button class="primary-button" id="successOrdersBtn" type="button">View orders</button>
        <button class="secondary-button" data-close="productModal" type="button">Continue shopping</button>
      </div>
    </div>
  `;
  productModal.classList.remove("hidden");
  document.getElementById("successOrdersBtn").addEventListener("click", () => {
    closeModal(productModal);
    openOrders();
  });
}

function showCheckoutError(message) {
  checkoutError.textContent = message;
  checkoutError.classList.remove("hidden");
}

function openOrders() {
  renderOrders();
  ordersModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function renderOrders() {
  if (!orders.length) {
    ordersContent.innerHTML = `
      <div class="no-orders">
        <h3>No orders yet</h3>
        <p>Place your first order and it will appear here.</p>
      </div>
    `;
    return;
  }

  ordersContent.innerHTML = orders.map(order => `
    <article class="order-card">
      <div class="order-top">
        <div>
          <div class="order-number">${escapeHtml(order.orderId)}</div>
          <div class="order-date">${new Date(order.createdAt).toLocaleString()}</div>
        </div>
        <span class="order-status">${escapeHtml(order.status)}</span>
      </div>
      <div class="order-customer">
        <strong>${escapeHtml(order.customer.fullName)}</strong> · ${escapeHtml(order.customer.email)} · ${escapeHtml(order.customer.phone)}<br>
        ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.city)} ${escapeHtml(order.customer.postalCode)} · ${escapeHtml(order.customer.payment)}
      </div>
      <div class="order-items">
        ${order.items.map(item => `<span class="order-item-pill">${escapeHtml(item.title)} × ${item.quantity}</span>`).join("")}
      </div>
      <div class="order-total">${money(order.totals.total)}</div>
    </article>
  `).join("");
}

function exportOrders() {
  const data = {
    exportedAt: new Date().toISOString(),
    orders
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "shopzone-orders.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Orders exported as shopzone-orders.json", true);
}

function showToast(message, success = false) {
  toast.textContent = message;
  toast.classList.toggle("success", success);
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll('input[name="category"]').forEach(input => {
    input.checked = input.value === category;
  });
  document.getElementById("categoryFilter").value = category;
  renderProducts();
  document.getElementById("productsSection").scrollIntoView({ behavior: "smooth" });
}

function resetFilters() {
  state.search = "";
  state.category = "all";
  state.price = "all";
  state.sort = "featured";

  document.getElementById("searchInput").value = "";
  document.getElementById("categoryFilter").value = "all";
  document.getElementById("sortSelect").value = "featured";
  document.getElementById("mobileSort").value = "featured";

  document.querySelectorAll('input[name="category"]').forEach(input => input.checked = input.value === "all");
  document.querySelectorAll('input[name="price"]').forEach(input => input.checked = input.value === "all");

  renderProducts();
}

function bindEvents() {
  document.getElementById("searchForm").addEventListener("submit", event => {
    event.preventDefault();
    state.search = document.getElementById("searchInput").value.trim();
    state.category = document.getElementById("categoryFilter").value;
    renderProducts();
    document.getElementById("productsSection").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("categoryFilter").addEventListener("change", event => {
    state.category = event.target.value;
    document.querySelectorAll('input[name="category"]').forEach(input => input.checked = input.value === state.category);
    renderProducts();
  });

  document.getElementById("searchInput").addEventListener("input", event => {
    state.search = event.target.value;
    renderProducts();
  });

  document.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener("change", event => {
      state.category = event.target.value;
      document.getElementById("categoryFilter").value = state.category;
      renderProducts();
    });
  });

  document.querySelectorAll('input[name="price"]').forEach(input => {
    input.addEventListener("change", event => {
      state.price = event.target.value;
      renderProducts();
    });
  });

  document.getElementById("sortSelect").addEventListener("change", event => {
    state.sort = event.target.value;
    document.getElementById("mobileSort").value = state.sort;
    renderProducts();
  });

  document.getElementById("mobileSort").addEventListener("change", event => {
    state.sort = event.target.value;
    document.getElementById("sortSelect").value = state.sort;
    renderProducts();
  });

  document.getElementById("clearFilters").addEventListener("click", resetFilters);
  document.getElementById("emptyReset").addEventListener("click", resetFilters);

  document.getElementById("mobileFilterBtn").addEventListener("click", () => {
    document.getElementById("filters").classList.toggle("mobile-open");
  });

  document.getElementById("cartBtn").addEventListener("click", openCart);
  document.getElementById("closeCart").addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", closeCart);

  document.getElementById("shopNowBtn").addEventListener("click", () => {
    document.getElementById("productsSection").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("ordersBtn").addEventListener("click", openOrders);
  document.getElementById("footerOrdersBtn").addEventListener("click", openOrders);

  document.getElementById("exportOrdersNav").addEventListener("click", exportOrders);
  document.getElementById("footerExportBtn").addEventListener("click", exportOrders);

  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById("mobileMenu").classList.remove("hidden");
  });

  document.getElementById("closeMobileMenu").addEventListener("click", () => {
    document.getElementById("mobileMenu").classList.add("hidden");
  });

  document.getElementById("mobileMenu").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    document.getElementById("mobileMenu").classList.add("hidden");
    setCategory(button.dataset.category);
  });

  document.querySelectorAll("[data-category]").forEach(button => {
    if (button.closest("#mobileMenu")) return;
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });

  checkoutForm.addEventListener("submit", placeOrder);

  document.addEventListener("click", event => {
    const addButton = event.target.closest("[data-add-cart]");
    if (addButton) {
      addToCart(addButton.dataset.addCart);
      return;
    }

    const viewButton = event.target.closest("[data-view-product]");
    if (viewButton) {
      openProduct(viewButton.dataset.viewProduct);
      return;
    }

    const quantityButton = event.target.closest("[data-quantity]");
    if (quantityButton) {
      updateCartQuantity(quantityButton.dataset.quantity, Number(quantityButton.dataset.change));
      return;
    }

    const removeButton = event.target.closest("[data-remove-cart]");
    if (removeButton) {
      removeFromCart(removeButton.dataset.removeCart);
      return;
    }

    const closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      const modal = document.getElementById(closeButton.dataset.close);
      if (modal) closeModal(modal);
    }

    if (event.target.id === "openCheckoutBtn") {
      openCheckout();
    }
  });

  [productModal, checkoutModal, ordersModal].forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.getElementById("accountBtn").addEventListener("click", () => {
    showToast("This demo uses local browser storage for customer orders.");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeCart();
      [productModal, checkoutModal, ordersModal].forEach(modal => closeModal(modal));
      document.getElementById("mobileMenu").classList.add("hidden");
    }
  });
}

renderProducts();
renderCart();
updateCartCount();
bindEvents();
