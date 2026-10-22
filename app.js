const products = [
  {
    id: "sunday-vase",
    name: "Sunday Morning Vase",
    maker: "Mara Studio · Portland, OR",
    category: "Home & living",
    price: 48,
    badge: "MAKER FAVORITE",
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=700&q=85",
    alt: "Sculptural cream ceramic vase on a warm neutral background",
  },
  {
    id: "golden-hoops",
    name: "Little Golden Hoops",
    maker: "Kindred Objects · Brooklyn, NY",
    category: "Jewelry",
    price: 62,
    badge: "HAND-FINISHED",
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=700&q=85",
    alt: "Handmade gold hoop earrings",
  },
  {
    id: "everyday-tote",
    name: "The Everyday Tote",
    maker: "Thread & Field · Asheville, NC",
    category: "Wearables",
    price: 54,
    badge: "SMALL BATCH",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=85",
    alt: "Handwoven canvas tote bag",
  },
  {
    id: "wildflower-print",
    name: "Wildflower No. 3",
    maker: "June Paper Co. · Hudson, NY",
    category: "Art & paper",
    price: 32,
    badge: "",
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=700&q=85",
    alt: "Colorful botanical art print",
  },
  {
    id: "clay-cup",
    name: "A Very Good Cup",
    maker: "Mara Studio · Portland, OR",
    category: "Home & living",
    price: 38,
    badge: "JUST LANDED",
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=700&q=85",
    alt: "Hand-thrown ceramic cup in a soft natural glaze",
  },
  {
    id: "linen-scrunchie",
    name: "Linen Sunday Scrunchie",
    maker: "Soft Ritual · Burlington, VT",
    category: "Wearables",
    price: 18,
    badge: "",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=85",
    alt: "Soft natural linen hair accessory",
  },
  {
    id: "tiny-pendant",
    name: "The Tiny Keepsake",
    maker: "Kindred Objects · Brooklyn, NY",
    category: "Jewelry",
    price: 76,
    badge: "A LITTLE TREASURE",
    image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=700&q=85",
    alt: "Delicate handcrafted gold pendant necklace",
  },
  {
    id: "good-things-notebook",
    name: "Good Things Notebook",
    maker: "June Paper Co. · Hudson, NY",
    category: "Art & paper",
    price: 24,
    badge: "",
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=700&q=85",
    alt: "Handmade paper notebook and stationery",
  },
];

const productGrid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#product-search");
const sortSelect = document.querySelector("#sort-products");
const categoryButtons = [...document.querySelectorAll(".category-chip")];
const drawer = document.querySelector(".cart-drawer");
const overlay = document.querySelector(".overlay");
const toast = document.querySelector(".toast");
let activeCategory = "All";
let cart = loadCart();
let toastTimeout;
let lastFocusedElement;

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem("goodfolk-cart") || "{}");
    return Object.fromEntries(
      Object.entries(stored).filter(([id, quantity]) =>
        products.some((product) => product.id === id) &&
        Number.isInteger(quantity) &&
        quantity > 0,
      ),
    );
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem("goodfolk-cart", JSON.stringify(cart));
  } catch {
    showToast("Your bag is ready for this visit.");
  }
}

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const sort = sortSelect.value;
  let visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesSearch = `${product.name} ${product.maker} ${product.category}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  if (sort === "price-low") visibleProducts.sort((a, b) => a.price - b.price);
  if (sort === "price-high") visibleProducts.sort((a, b) => b.price - a.price);
  if (sort === "name") visibleProducts.sort((a, b) => a.name.localeCompare(b.name));

  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${product.image}" alt="${product.alt}" loading="lazy" />
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
        <button class="quick-add" type="button" data-add="${product.id}" aria-label="Add ${product.name} to your bag">+</button>
      </div>
      <div class="product-info">
        <div><h3 class="product-name">${product.name}</h3><p class="product-maker">${product.maker}</p></div>
        <span class="product-price">${formatPrice(product.price)}</span>
      </div>
    </article>
  `).join("");
  document.querySelector(".empty-state").hidden = visibleProducts.length > 0;
}

function renderCart() {
  const items = Object.entries(cart)
    .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
    .filter(({ product }) => product);
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, { product, quantity }) => total + product.price * quantity, 0);

  document.querySelector(".cart-count").textContent = count;
  document.querySelector(".drawer-count").textContent = `(${count})`;
  document.querySelector(".subtotal-row strong").textContent = formatPrice(subtotal);
  const remaining = Math.max(0, 75 - subtotal);
  document.querySelector(".shipping-message").innerHTML = remaining
    ? `You're <strong>${formatPrice(remaining)}</strong> away from free shipping.`
    : "Lovely! Your order ships free.";
  document.querySelector(".shipping-progress span").style.width = `${Math.min(100, (subtotal / 75) * 100)}%`;
  document.querySelector(".cart-items").innerHTML = items.map(({ product, quantity }) => `
    <article class="cart-item">
      <img src="${product.image}" alt="" />
      <div>
        <h3>${product.name}</h3>
        <p>${product.maker}</p>
        <div class="quantity-control" aria-label="Quantity for ${product.name}">
          <button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Remove one ${product.name}">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${product.id}" data-change="1" aria-label="Add one ${product.name}">+</button>
        </div>
      </div>
      <span class="cart-item-price">${formatPrice(product.price * quantity)}</span>
    </article>
  `).join("");
  drawer.classList.toggle("empty", count === 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2300);
}

function openCart() {
  lastFocusedElement = document.activeElement;
  renderCart();
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  document.body.classList.add("drawer-open");
  requestAnimationFrame(() => drawer.classList.add("open"));
  drawer.querySelector(".close-cart").focus();
}

function closeCart() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.classList.remove("drawer-open");
  lastFocusedElement?.focus();
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  showToast(`${products.find((product) => product.id === id).name} added to your bag`);
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderProducts();
  });
});

document.querySelectorAll("[data-nav-category]").forEach((link) => {
  link.addEventListener("click", () => {
    activeCategory = link.dataset.navCategory;
    categoryButtons.forEach((button) => button.classList.toggle("active", button.dataset.category === activeCategory));
    renderProducts();
  });
});

searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);
productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});

document.querySelector(".cart-toggle").addEventListener("click", openCart);
document.querySelector(".close-cart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.querySelectorAll(".continue-shopping").forEach((button) => {
  button.addEventListener("click", () => {
    closeCart();
    document.querySelector("#shop").scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelector(".search-toggle").addEventListener("click", () => {
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => searchInput.focus(), 350);
});

document.querySelector(".cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (!button) return;
  const id = button.dataset.quantity;
  cart[id] += Number(button.dataset.change);
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart();
});

document.querySelector(".checkout-button").addEventListener("click", () => {
  showToast("Thanks for shopping small — checkout is coming soon!");
});

document.querySelector(".newsletter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("You're on the list. Look out for a little good news!");
  event.currentTarget.reset();
});

const menuToggle = document.querySelector(".mobile-menu-toggle");
menuToggle.addEventListener("click", () => {
  const menu = document.querySelector(".main-nav");
  const isOpen = menu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelector(".main-nav").classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.classList.contains("open")) closeCart();
});

renderProducts();
renderCart();
