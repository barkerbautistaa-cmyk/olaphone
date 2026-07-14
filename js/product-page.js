/**
 * =============================================================================
 * OLAPHONE — MÓDULO: PÁGINA DE DETALLE DE PRODUCTO (producto.html?id=...)
 * =============================================================================
 * Réplica de la experiencia de producto de bphone:
 *   - Hero: miniaturas verticales + imagen principal | ficha (título, precio,
 *     píldora de stock, descripción, cantidad + agregar al carrito)
 *   - Secciones: Características técnicas + Beneficios
 *   - "También puede gustarte" con productos relacionados
 * Los datos salen del mismo webhook de n8n que usa el catálogo del index.
 * =============================================================================
 */

(function () {
  "use strict";

  const PRODUCTS_URL = window.PRODUCTS_URL || "./products.json";
  const CACHE_BUST   = `?t=${Math.floor(Date.now() / 60000)}`;

  function fmt(n) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
  }

  function esc(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function getCartQty(id) {
    if (!window.Cart) return 0;
    const item = window.Cart.items.find((i) => i.id === id);
    return item ? item.cantidad : 0;
  }

  // Convierte links de Google Drive (compartir) en links directos de imagen.
  // Permite pegar en la Sheet el link que da Drive al subir un PNG/JPG.
  function normalizeImg(url) {
    const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200` : url;
  }

  // Logo de marca que se agrega SOLO como última imagen de la galería.
  const BRAND_IMG = "assets/logo-marca.png";

  function productImages(p) {
    const propias = p.imagen
      ? p.imagen.split(",").map(i => normalizeImg(i.trim())).filter(Boolean)
      : [];
    // Sin fotos propias -> no se agrega el logo (se muestra el placeholder 📦).
    if (!propias.length) return [];
    return [...propias.slice(0, 3), BRAND_IMG];
  }

  function categoriaLabel(cat) {
    const c = (cat || "").toLowerCase();
    const map = {
      telefonia: "Telefonía", computacion: "Computación",
      accesorios: "Accesorios", importados: "Importados", servicio: "Servicio Técnico",
    };
    return map[c] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Producto");
  }

  // ── RENDER: HERO DEL PRODUCTO ────────────────────────────────────────────
  function renderDetail(p) {
    const images = productImages(p);
    const enCarrito = getCartQty(p.id);
    const maxPermitido = Math.max(0, p.stock - enCarrito);

    const stockText = p.stock > 0
      ? `Stock disponible: ${p.stock} unidad${p.stock !== 1 ? "es" : ""}`
      : "Sin stock";

    const mainImgHTML = images.length > 0
      ? `<img class="pm-main-img" src="${esc(images[0])}" alt="${esc(p.nombre)}" />`
      : `<div class="pm-no-img" role="img" aria-label="Sin imagen de ${esc(p.nombre)}">📦</div>`;

    const thumbsHTML = images.length > 1
      ? `<div class="pm-thumbs">
           ${images.map((src, i) =>
             `<button type="button" class="pm-thumb ${i === 0 ? "active" : ""}" data-i="${i}"
                      aria-label="Imagen ${i + 1} de ${esc(p.nombre)}">
                <img src="${esc(src)}" alt="${esc(p.nombre)} vista ${i + 1}" />
              </button>`
           ).join("")}
         </div>`
      : "";

    return `
      <section class="pd-hero">
        <div class="pm-media${images.length > 1 ? "" : " pm-media-single"}">
          ${thumbsHTML}
          <div class="pm-main">
            ${mainImgHTML}
          </div>
        </div>

        <div class="pm-info">
          <span class="pm-cat">${esc(categoriaLabel(p.categoria))}</span>
          <h1 class="pm-title">${esc(p.nombre)}</h1>
          <p class="pm-price">${fmt(p.precio)}</p>
          ${p.precio_contado
            ? `<p class="pm-contado">Precio de contado: <strong>${fmt(p.precio_contado)}</strong></p>`
            : ""}
          <span class="pm-pill ${p.stock > 0 ? "" : "pm-pill-out"}">${stockText}</span>

          ${(p.cuotas_3 || p.cuotas_6 || p.cuotas_12) ? `
          <ul class="pm-cuotas">
            ${p.cuotas_3  ? `<li><strong>3 cuotas sin interés</strong><span>${fmt(p.cuotas_3)} por mes</span></li>` : ""}
            ${p.cuotas_6  ? `<li><strong>6 cuotas</strong><span>${fmt(p.cuotas_6)} por mes</span></li>` : ""}
            ${p.cuotas_12 ? `<li><strong>12 cuotas</strong><span>${fmt(p.cuotas_12)} por mes</span></li>` : ""}
          </ul>` : ""}

          ${p.descripcion ? `<p class="pm-desc">${esc(p.descripcion)}</p>` : ""}

          ${enCarrito > 0 ? `<p class="product-in-cart">✓ ${enCarrito} en tu carrito</p>` : ""}

          <div class="pm-purchase-row">
            ${maxPermitido > 0 ? `
              <div class="card-qty-control">
                <button type="button" class="btn-qty" data-qty-dec aria-label="Disminuir cantidad">─</button>
                <input type="number" class="input-qty" data-qty value="1" min="1" max="${maxPermitido}" readonly />
                <button type="button" class="btn-qty" data-qty-inc aria-label="Aumentar cantidad">┼</button>
              </div>
              <button type="button" class="btn-add-to-cart" data-add>🛒 Agregar al carrito</button>
            ` : `
              <button type="button" class="btn-add-to-cart" disabled>
                ${p.stock <= 0 ? "Sin stock" : "Máximo en carrito"}
              </button>
            `}
          </div>

          <p class="pm-meta">Retiro en el local de Olavarría o envío a todo el país. Garantía incluida.</p>

          <p class="pm-hint">Consultas por este producto:
            <a href="https://wa.me/${window.OWNER_PHONE || "542284641652"}?text=${encodeURIComponent(`Hola OlaPhone! Quiero consultar por: ${p.nombre}`)}"
               target="_blank" rel="noopener">escribinos por WhatsApp</a>
          </p>
        </div>
      </section>

      <section class="pd-sections">
        <article class="pd-card">
          <h2>Características técnicas</h2>
          <ul>
            <li><strong>Modelo</strong><span>${esc(p.nombre)}</span></li>
            <li><strong>Categoría</strong><span>${esc(categoriaLabel(p.categoria))}</span></li>
            <li><strong>Disponibilidad</strong><span>${p.stock > 0 ? `${p.stock} en stock` : "Consultar"}</span></li>
            ${(p.descripcion || "")
              .split(/\.\s+|\.$/)
              .map(s => s.trim())
              .filter(Boolean)
              .map(s => `<li class="pd-row-full"><span>${esc(s)}</span></li>`)
              .join("")}
          </ul>
        </article>
        <article class="pd-card">
          <h2>Beneficios</h2>
          <ul>
            <li class="pd-row-full"><span>Producto verificado antes de la entrega.</span></li>
            <li class="pd-row-full"><span>Retiro coordinado en Olavarría o envío a todo el país.</span></li>
            <li class="pd-row-full"><span>Atención directa por WhatsApp, sin bots que te marean.</span></li>
            <li class="pd-row-full"><span>Servicio técnico propio para el post-venta.</span></li>
          </ul>
        </article>
      </section>
    `;
  }

  // ── RENDER: RELACIONADOS ─────────────────────────────────────────────────
  function renderRelated(catalog, current) {
    const grid = document.getElementById("related-grid");
    if (!grid) return;

    const mismos = catalog.filter(x => x.id !== current.id && x.categoria === current.categoria);
    const otros  = catalog.filter(x => x.id !== current.id && x.categoria !== current.categoria);
    const related = [...mismos, ...otros].slice(0, 4);

    grid.innerHTML = related.map(p => {
      const images = productImages(p);
      const imgHTML = images.length > 0
        ? `<img src="${esc(images[0])}" alt="${esc(p.nombre)}" class="product-img" loading="lazy" />`
        : `<div class="product-no-img" role="img" aria-label="Sin imagen">📦</div>`;
      return `
        <article class="product-card animate-in" role="listitem" data-goto-id="${esc(p.id)}" style="cursor:pointer">
          <div class="product-img-wrap">${imgHTML}</div>
          <div class="product-info">
            <h3 class="product-name">${esc(p.nombre)}</h3>
            <p class="product-price">${fmt(p.precio)}</p>
          </div>
          <div class="product-card-footer">
            <button type="button" class="btn-add-to-cart" data-related-add="${esc(p.id)}"
              ${p.stock <= 0 ? "disabled" : ""}>
              ${p.stock <= 0 ? "Sin stock" : "🛒 Agregar al carrito"}
            </button>
          </div>
        </article>`;
    }).join("");

    // Click en tarjeta → detalle; click en botón → carrito
    grid.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-related-add]");
      if (addBtn) {
        const p = catalog.find(x => x.id === addBtn.dataset.relatedAdd);
        if (p && window.Cart) {
          const r = window.Cart.addItem({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock });
          if (r.success) window.Cart.openDrawer();
        }
        return;
      }
      const card = e.target.closest("[data-goto-id]");
      if (card) window.location.href = `producto.html?id=${encodeURIComponent(card.dataset.gotoId)}`;
    });
  }

  // ── LIGHTBOX (zoom de la imagen principal) ───────────────────────────────
  function openLightbox(images, nombre) {
    if (!images.length) return;
    const old = document.getElementById("olaphone-lightbox");
    if (old) old.remove();

    let lbIdx = 0;
    const overlay = document.createElement("div");
    overlay.id = "olaphone-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="lb-backdrop"></div>
      <div class="lb-box">
        <button class="lb-close" aria-label="Cerrar">✕</button>
        <div class="lb-img-wrap">
          <img class="lb-img" src="${esc(images[0])}" alt="${esc(nombre)}" />
          ${images.length > 1 ? `
            <button class="lb-nav lb-prev" aria-label="Anterior">❮</button>
            <button class="lb-nav lb-next" aria-label="Siguiente">❯</button>
          ` : ""}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => overlay.classList.add("active"));

    const lbImg = overlay.querySelector(".lb-img");
    function show(i) {
      lbIdx = i;
      lbImg.src = images[i];
    }
    overlay.querySelector(".lb-prev")?.addEventListener("click", () => show(lbIdx > 0 ? lbIdx - 1 : images.length - 1));
    overlay.querySelector(".lb-next")?.addEventListener("click", () => show(lbIdx < images.length - 1 ? lbIdx + 1 : 0));

    function close() {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 300);
    }
    overlay.querySelector(".lb-close").addEventListener("click", close);
    overlay.querySelector(".lb-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
    });
  }

  // ── INTERACCIONES DEL HERO ───────────────────────────────────────────────
  function initHero(p) {
    const images = productImages(p);
    const mainImg = document.querySelector(".pm-main-img");
    const thumbs = document.querySelectorAll(".pm-thumb");

    thumbs.forEach(t => t.addEventListener("click", () => {
      const i = +t.dataset.i;
      if (!mainImg) return;
      mainImg.style.opacity = "0";
      setTimeout(() => { mainImg.src = images[i]; mainImg.style.opacity = "1"; }, 120);
      thumbs.forEach((x, j) => x.classList.toggle("active", j === i));
    }));

    if (mainImg) {
      mainImg.style.cursor = "zoom-in";
      mainImg.addEventListener("click", () => openLightbox(images, p.nombre));
    }

    const qtyInput = document.querySelector("[data-qty]");
    const maxPermitido = Math.max(0, p.stock - getCartQty(p.id));
    document.querySelector("[data-qty-dec]")?.addEventListener("click", () => {
      const v = parseInt(qtyInput.value) || 1;
      if (v > 1) qtyInput.value = v - 1;
    });
    document.querySelector("[data-qty-inc]")?.addEventListener("click", () => {
      const v = parseInt(qtyInput.value) || 1;
      if (v < maxPermitido) qtyInput.value = v + 1;
    });

    document.querySelector("[data-add]")?.addEventListener("click", () => {
      if (!window.Cart) return;
      const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
      let result;
      for (let i = 0; i < qty; i++) {
        result = window.Cart.addItem({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock });
        if (!result.success) break;
      }
      if (result && result.success) window.Cart.openDrawer();
    });
  }

  // ── CARGA ────────────────────────────────────────────────────────────────
  async function load() {
    const detail = document.getElementById("product-detail");
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { window.location.href = "index.html#catalogo"; return; }

    async function fetchCatalog(url) {
      const res = await fetch(url + CACHE_BUST, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-cache",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.productos || []);
    }

    try {
      let catalog;
      try {
        catalog = await fetchCatalog(PRODUCTS_URL);
      } catch (err) {
        // Si falla el origen en vivo (ej. n8n sin ejecuciones disponibles),
        // usamos el catálogo de respaldo local en vez de romper la página.
        if (PRODUCTS_URL === "./products.json") throw err;
        console.error("[Producto] Origen en vivo falló, usando respaldo local:", err);
        catalog = await fetchCatalog("./products.json");
      }

      const product = catalog.find(x => String(x.id).trim() === String(id).trim());

      if (!product) { window.location.href = "index.html#catalogo"; return; }

      document.title = `${product.nombre} | OlaPhone Olavarría`;
      detail.innerHTML = renderDetail(product);
      initHero(product);
      renderRelated(catalog, product);

    } catch (err) {
      console.error("[Producto] Error al cargar:", err);
      detail.innerHTML = `
        <div class="pd-error">
          <p>No pudimos cargar el producto. Verificá tu conexión.</p>
          <a class="btn-outline" href="index.html#catalogo">Volver al catálogo</a>
        </div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();
