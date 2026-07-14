/**
 * =============================================================================
 * OLAPHONE — MÓDULO: CARGA Y RENDERIZADO DE PRODUCTOS
 * =============================================================================
 * Fetcha products.json del backend, renderiza las cards de productos,
 * maneja estados de carga (skeletons), error y re-render reactivo
 * cuando el carrito cambia (actualiza botones y cantidades).
 * =============================================================================
 */

(function () {
  "use strict";

  // ── CONFIG ───────────────────────────────────────────────────────────────
  const PRODUCTS_URL = window.PRODUCTS_URL || "./products.json";
  const CACHE_BUST   = `?t=${Math.floor(Date.now() / 60000)}`;

  // ── ESTADO ───────────────────────────────────────────────────────────────
  let catalog = [];
  let currentSort   = "destacados"; // orden activo (select del catálogo)
  let currentFilter = "todos";      // categoría activa (cards de categoría)

  // Mapa de filtro -> palabras que acepta en el campo categoria del CSV
  const CATEGORY_MAP = {
    telefonia:   ["telefonia", "telefon", "celular", "smartphone", "iphone", "samsung", "motorola"],
    computacion: ["computacion", "computadora", "laptop", "tablet", "notebook", "macbook", "pc"],
    accesorios:  ["accesorios", "accesorio", "auricular", "cable", "cargador", "smartwatch", "funda"],
    servicio:    ["reparaciones", "servicio", "tecnico", "técnico", "reparacion", "reparación"],
    importados:  ["importados", "importado", "zapatilla", "calzado", "consola", "ps5"],
  };

  const stripAccents = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function matchesCategory(p, filter) {
    if (filter === "todos" || !filter) return true;
    const keys = CATEGORY_MAP[filter] || [filter];
    const cat = stripAccents(p.categoria);
    return keys.some((k) => cat.includes(stripAccents(k)));
  }

  // Devuelve una copia ordenada según currentSort. "destacados" = orden original.
  function sortList(list) {
    const arr = list.slice();
    switch (currentSort) {
      case "precio-asc":  return arr.sort((a, b) => (a.precio || 0) - (b.precio || 0));
      case "precio-desc": return arr.sort((a, b) => (b.precio || 0) - (a.precio || 0));
      case "nombre":      return arr.sort((a, b) => stripAccents(a.nombre).localeCompare(stripAccents(b.nombre)));
      default:            return arr; // destacados
    }
  }

  // Lista visible = catálogo filtrado por categoría y luego ordenado.
  function getVisible() {
    return sortList(catalog.filter((p) => matchesCategory(p, currentFilter)));
  }

  // ── UTILIDADES ───────────────────────────────────────────────────────────
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

  // Toma las imágenes propias del producto y agrega el logo como cierre.
  // Sin fotos propias -> no se agrega (se muestra el placeholder 📦).
  function withBrand(imgs) {
    if (!imgs.length) return imgs;
    return [...imgs.slice(0, 3), BRAND_IMG];
  }

  function getStockBadge(stock) {
    if (stock <= 0)  return { cls: "badge-outofstock", label: "Sin stock" };
    if (stock <= 3)  return { cls: "badge-lowstock",   label: `¡Últimas ${stock}!` };
    return            { cls: "badge-instock",   label: "En stock" };
  }

  // ── CONSTRUCCIÓN DE CARD ─────────────────────────────────────────────────
  function buildProductCard(p) {
    const { id, nombre, stock, precio, imagen, descripcion } = p;
    const sinStock     = stock <= 0;
    const enCarrito    = getCartQty(id);
    const maxPermitido = sinStock ? 0 : Math.max(0, stock - enCarrito);
    const stockAgotado = maxPermitido === 0 && !sinStock;
    const badge        = getStockBadge(stock);

    // Texto dinámico del botón
    let btnText = "🛒 Agregar al carrito";
    let btnDisabled = false;
    if (sinStock) {
      btnText = "Sin stock";
      btnDisabled = true;
    } else if (stockAgotado) {
      btnText = "Máximo en carrito";
      btnDisabled = true;
    }

    // Procesar imágenes (soporta separadas por coma desde Drive)
    let images = [];
    if (imagen) {
      images = imagen.split(",").map(i => normalizeImg(i.trim())).filter(i => i.length > 0);
    }
    images = withBrand(images);
    
    // Generar HTML de la galería
    let galleryHTML = `<div class="product-no-img" role="img" aria-label="Sin imagen de ${esc(nombre)}">📦</div>`;
    if (images.length === 1) {
      galleryHTML = `<img src="${esc(images[0])}" alt="${esc(nombre)}" class="product-img" loading="lazy" width="400" height="300" />`;
    } else if (images.length > 1) {
      const slides = images.map((src, idx) => 
        `<img src="${esc(src)}" alt="${esc(nombre)} - Foto ${idx+1}" class="product-img gallery-slide ${idx === 0 ? 'active' : ''}" loading="lazy" data-idx="${idx}" width="400" height="300" />`
      ).join("");
      
      galleryHTML = `
        <div class="product-gallery">
          ${slides}
          <button class="gallery-btn prev" type="button" aria-label="Foto anterior">❮</button>
          <button class="gallery-btn next" type="button" aria-label="Siguiente foto">❯</button>
          <div class="gallery-dots">
            ${images.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}"></span>`).join("")}
          </div>
        </div>
      `;
    }

    const card = document.createElement("article");
    card.setAttribute("role", "listitem");
    card.setAttribute("data-product-id", id);
    card.className = `product-card animate-in${sinStock ? " out-of-stock" : ""}`;

    card.innerHTML = `
      <div class="product-img-wrap">
        ${galleryHTML}
        <span class="product-stock-badge ${badge.cls}" aria-label="${badge.label}">
          ${badge.label}
        </span>
      </div>

      <div class="product-info">
        <h3 class="product-name" id="pname-${esc(id)}">${esc(nombre)}</h3>

        ${descripcion
          ? `<p class="product-description">${esc(descripcion)}</p>`
          : ""
        }

        <p class="product-price" aria-label="Precio: ${fmt(precio)}">
          ${fmt(precio)}
        </p>

        ${p.cuotas_3
          ? `<p class="product-cuotas">3 cuotas sin interés de ${fmt(p.cuotas_3)}</p>`
          : ""
        }

        ${enCarrito > 0
          ? `<p class="product-in-cart" aria-live="polite">
               ✓ ${enCarrito} en tu carrito
             </p>`
          : ""
        }
      </div>

      <div class="product-card-footer">
        ${!sinStock && !stockAgotado ? `
        <div class="card-qty-control">
          <button type="button" class="btn-qty decrease" aria-label="Disminuir cantidad">─</button>
          <input type="number" class="input-qty" value="1" min="1" max="${maxPermitido}" aria-label="Cantidad a agregar" readonly />
          <button type="button" class="btn-qty increase" aria-label="Aumentar cantidad">┼</button>
        </div>
        ` : ''}
        <button
          id="btn-add-${esc(id)}"
          type="button"
          class="btn-add-to-cart"
          data-product-id="${esc(id)}"
          aria-label="${btnDisabled ? btnText : `Agregar ${esc(nombre)} al carrito`}"
          ${btnDisabled ? "disabled" : ""}
        >
          ${btnText}
        </button>
      </div>
    `;

    // Event listeners para Galería (carrusel en tarjeta)
    if (images.length > 1) {
      let currentIdx = 0;
      const gallerySlides = card.querySelectorAll(".gallery-slide");
      const dots = card.querySelectorAll(".dot");
      const btnPrev = card.querySelector(".gallery-btn.prev");
      const btnNext = card.querySelector(".gallery-btn.next");

      const showSlide = (idx) => {
        gallerySlides.forEach(s => s.classList.remove("active"));
        dots.forEach(d => d.classList.remove("active"));
        gallerySlides[idx].classList.add("active");
        dots[idx].classList.add("active");
      };

      btnPrev.addEventListener("click", (e) => {
        e.stopPropagation();
        currentIdx = currentIdx > 0 ? currentIdx - 1 : gallerySlides.length - 1;
        showSlide(currentIdx);
      });
      btnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        currentIdx = currentIdx < gallerySlides.length - 1 ? currentIdx + 1 : 0;
        showSlide(currentIdx);
      });
    }

    // Click en la tarjeta → página de detalle del producto (como bphone)
    // (se ignoran los clicks sobre controles: botones, cantidad, flechas, dots)
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, input, .card-qty-control, .gallery-dots")) return;
      window.location.href = `producto.html?id=${encodeURIComponent(id)}`;
    });

    // Event listeners para Cantidad
    const qtyInput = card.querySelector(".input-qty");
    const btnDecrease = card.querySelector(".btn-qty.decrease");
    const btnIncrease = card.querySelector(".btn-qty.increase");

    if (qtyInput && btnDecrease && btnIncrease) {
      btnDecrease.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });
      btnIncrease.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < maxPermitido) qtyInput.value = val + 1;
      });
    }

    // Event listener del botón Agregar
    const btn = card.querySelector(".btn-add-to-cart");
    btn.addEventListener("click", () => {
      if (!window.Cart) return;

      const qtyToAdd = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
      btn.classList.add("adding");
      
      let lastResult;
      // Agregar N veces (la clase Cart solo permite addItem 1 por 1, o podríamos modificar cart.js)
      // Como cart.js solo tiene addItem(producto) que suma 1, lo llamamos qtyToAdd veces.
      for (let i = 0; i < qtyToAdd; i++) {
        lastResult = window.Cart.addItem({ id, nombre, precio, stock });
        if (!lastResult.success) break;
      }

      if (lastResult && lastResult.success) {
        window.Cart.openDrawer();
      } else if (lastResult) {
        const original = btn.textContent;
        btn.textContent = lastResult.message;
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = "Máximo en carrito";
        }, 2000);
      }

      btn.classList.remove("adding");
      
      // Reset input y deshabilitar si llegó al límite
      const nuevoEnCarrito = getCartQty(id);
      const nuevoMaxPermitido = stock - nuevoEnCarrito;
      if (qtyInput) {
        if (nuevoMaxPermitido <= 0) {
          card.querySelector(".card-qty-control").style.display = "none";
          btn.textContent = "Máximo en carrito";
          btn.disabled = true;
        } else {
          qtyInput.max = nuevoMaxPermitido;
          qtyInput.value = 1;
        }
      }
    });

    return card;
  }

  // ── RENDER GRILLA ────────────────────────────────────────────────────────
  function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid || catalog.length === 0) return;

    const visible = getVisible();

    // Limpiar skeletons y cards anteriores
    grid.innerHTML = "";

    // Servicio técnico no es un producto: en vez de "0 productos" mostramos
    // una tarjeta de contacto directo por WhatsApp.
    if (currentFilter === "servicio") {
      grid.innerHTML = `
        <div class="service-cta" role="group" aria-label="Servicio técnico">
          <div class="service-cta-icon" aria-hidden="true">🔧</div>
          <h3 class="service-cta-title">Servicio Técnico</h3>
          <p class="service-cta-text">
            Reparación profesional de celulares, tablets y laptops.
            Diagnóstico sin cargo. Escribinos y te asesoramos al toque.
          </p>
          <a
            href="https://wa.me/542284641652?text=Hola%20OlaPhone!%20Necesito%20servicio%20t%C3%A9cnico."
            target="_blank" rel="noopener noreferrer"
            class="btn-service service-cta-btn"
            aria-label="Contactar servicio técnico por WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.5-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2z"/>
            </svg>
            Contactar servicio técnico por WhatsApp
          </a>
          <button type="button" class="service-cta-back"
            onclick="document.querySelector('[data-filter=todos]').click()">← Ver productos</button>
        </div>`;
      setStatus("Servicio técnico: contactanos por WhatsApp.");
      return;
    }

    if (visible.length === 0) {
      grid.innerHTML = `
        <p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem 0">
          Sin productos en esta categoría. <button
            onclick="document.querySelector('[data-filter=todos]').click()"
            style="color:var(--accent-light);background:none;border:none;cursor:pointer;font-family:inherit;font-size:inherit"
          >Ver todo</button>
        </p>`;
      setStatus(`0 productos en esta categoría.`, "warn");
      return;
    }

    visible.forEach((p, i) => {
      const card = buildProductCard(p);
      // Escalonar la animación de entrada
      card.style.animationDelay = `${i * 0.05}s`;
      grid.appendChild(card);
    });

    setStatus(`${visible.length} producto${visible.length !== 1 ? "s" : ""}${currentFilter !== "todos" ? " en esta categoría" : " disponible" + (visible.length !== 1 ? "s" : "")}.`);
  }

  // ── STATUS ───────────────────────────────────────────────────────────────
  function setStatus(msg, type = "info") {
    const el = document.getElementById("products-status");
    if (!el) return;
    el.textContent  = msg;
    el.dataset.type = type;
  }

  // ── FETCH ────────────────────────────────────────────────────────────────
  async function fetchProducts(url) {
    const res = await fetch(url + CACHE_BUST, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function applyProducts(data) {
    catalog = Array.isArray(data)
      ? data
      : Array.isArray(data.productos)
        ? data.productos
        : [];

    if (catalog.length === 0) {
      setStatus("No hay productos disponibles en este momento.", "warn");
      document.getElementById("products-grid").innerHTML =
        `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem 0">
           Sin productos disponibles. Volvé pronto. 🔄
         </p>`;
      return;
    }

    // Actualizar indicador de stock en footer
    if (data.updatedAt) {
      const el = document.getElementById("stock-last-update");
      if (el) {
        el.textContent = `Stock actualizado: ${new Date(data.updatedAt).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
        })}`;
      }
    }

    renderProducts();
  }

  async function loadProducts() {
    setStatus("Cargando catálogo...");

    try {
      const data = await fetchProducts(PRODUCTS_URL);
      applyProducts(data);
      if (catalog.length > 0) {
        setStatus(`${catalog.length} producto${catalog.length !== 1 ? "s" : ""} disponible${catalog.length !== 1 ? "s" : ""}`);
      }

    } catch (err) {
      console.error("[Products] Error al cargar catálogo:", err);

      // Si falla el origen en vivo (ej. n8n sin ejecuciones disponibles),
      // mostramos el catálogo de respaldo local en vez de romper la página,
      // y seguimos reintentando el origen real en segundo plano.
      if (PRODUCTS_URL !== "./products.json") {
        try {
          const fallback = await fetchProducts("./products.json");
          applyProducts(fallback);
          if (catalog.length > 0) {
            setStatus("Mostrando catálogo guardado (reconectando con el sistema en vivo)...", "warn");
          }
          setTimeout(() => loadProducts(), 15000);
          return;
        } catch (fallbackErr) {
          console.error("[Products] Fallback local también falló:", fallbackErr);
        }
      }

      // Limpiar skeletons y mostrar error
      const grid = document.getElementById("products-grid");
      if (grid) grid.innerHTML = "";

      setStatus("No se pudo cargar el catálogo. Verificá tu conexión.", "error");

      // Retry automático después de 10 segundos
      setTimeout(() => {
        console.log("[Products] Reintentando carga...");
        loadProducts();
      }, 10000);
    }
  }

  // ── FILTRADO POR CATEGORÍA ───────────────────────────────────────────────
  /**
   * Conecta los clicks en las tarjetas de categoría con el filtrado de productos.
   * Usa el atributo data-filter para determinar la categoría.
   */
  function initCategoryFilter() {
    document.querySelectorAll(".category-card[data-filter]").forEach((card) => {
      card.addEventListener("click", () => {
        currentFilter = card.dataset.filter || "todos";
        // Scroll suave al catálogo
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
        renderProducts();
      });
    });
  }

  // ── ORDEN (select del catálogo) ──────────────────────────────────────────
  function initSort() {
    const sel = document.getElementById("sort-products");
    if (!sel) return;
    sel.addEventListener("change", () => {
      currentSort = sel.value;
      renderProducts();
    });
  }

  /* (código de filtrado anterior — reemplazado por matchesCategory/getVisible)

        const keys = categoryMap[filter] || [filter];
        const filtered = catalog.filter((p) => {
          const cat = (p.categoria || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return keys.some(k => cat.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        });

        const grid = document.getElementById("products-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (filtered.length === 0) {
          grid.innerHTML = `
            <p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem 0">
              Sin productos en esta categoría. <button
                onclick="document.querySelector('[data-filter=todos]').click()"
                style="color:var(--accent-light);background:none;border:none;cursor:pointer;font-family:inherit;font-size:inherit"
              >Ver todo</button>
            </p>`;
        } else {
          filtered.forEach((p, i) => {
            const c = buildProductCard(p);
            c.style.animationDelay = `${i * 0.05}s`;
            grid.appendChild(c);
          });
        }

        setStatus(`${filtered.length} producto${filtered.length !== 1 ? "s" : ""} en esta categoría.`);
      });
    });
  }
  */

  // ── GALERÍA "NUESTRA TIENDA" → NAVEGAR A CATEGORÍA ───────────────────────
  // Las imágenes de la galería con data-goto llevan a su categoría del catálogo.
  function initGalleryLinks() {
    document.querySelectorAll(".gallery-item[data-goto]").forEach((item) => {
      item.style.cursor = "pointer";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      const go = () => {
        const target = document.querySelector(`.category-card[data-filter="${item.dataset.goto}"]`);
        if (target) target.click(); // filtra y scrollea al catálogo
      };
      item.addEventListener("click", go);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });
  }

  // ── EVENT LISTENERS ──────────────────────────────────────────────────────
  // Re-renderizar cuando el carrito cambia (actualiza botones y cantidades)
  document.addEventListener("cart:changed", () => {
    if (catalog.length > 0) renderProducts();
  });

  // ── INICIALIZACIÓN ───────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    initCategoryFilter();
    initSort();
    initGalleryLinks();
    loadProducts();
  });

})();
