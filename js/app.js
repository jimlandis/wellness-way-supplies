/* The Wellness Way Supplies – DRAFT portal logic (cart, prices, checkout, orders, account).
   DEMO ONLY. All data lives in this browser's localStorage. No network calls except
   reading the local data/prices.json file from the same folder. No email is sent. */
(function(){
  var LS = window.localStorage;
  var CAT = window.WWS_CATALOG || { products: [] };
  var ROOT = document.documentElement.getAttribute("data-root") || "";

  /* "[TBD]" profile values become placeholders, not real input values */
  function prefill(el, v){ if(!el) return; if(v === "[TBD]"){ el.value = ""; el.placeholder = "[TBD]"; } else el.value = v || ""; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function readJSON(k, d){ try{ var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function writeJSON(k, v){ LS.setItem(k, JSON.stringify(v)); }
  function $(s, el){ return (el || document).querySelector(s); }
  function $$(s, el){ return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  /* ---------------- catalog lookup ---------------- */
  var BY_SKU = {};
  CAT.products.forEach(function(p){ p.variants.forEach(function(v){ BY_SKU[v.sku] = { product:p, variant:v }; }); });

  /* ---------------- prices (ONE editable file: data/prices.json) ---------------- */
  var PRICES = {}, priceSource = "none";
  function validPrice(v){ return (typeof v === "number" && isFinite(v) && v >= 0) ? v : null; }
  function price(sku){ return validPrice(PRICES[sku]); }
  var money = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" });
  function fmt(v){ return v == null ? '<span class="tbd">Price TBD</span>' : money.format(v); }
  function fmtTotal(v){ return v == null ? '<span class="tbd">Total TBD</span>' : money.format(v); }
  function loadPrices(){
    /* Over http(s) the JSON file is read directly. When the files are opened straight from
       disk (file://) browsers block fetch(), so js/prices.js (a copy made by tools/sync_prices.py)
       is used instead. */
    var fallback = function(){ PRICES = window.WWS_PRICES_FALLBACK || {}; priceSource = "js/prices.js (fallback)"; };
    if(location.protocol === "file:" || !window.fetch){ fallback(); return Promise.resolve(); }
    return fetch(ROOT + "data/prices.json", { cache:"no-store" })
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(j){ PRICES = j || {}; priceSource = "data/prices.json"; })
      .catch(function(){ fallback(); });
  }

  /* ---------------- cart ---------------- */
  var CART_KEY = "wws_cart_ethan";
  function cart(){ return readJSON(CART_KEY, []).filter(function(l){ return BY_SKU[l.sku] && l.qty > 0; }); }
  function saveCart(c){ writeJSON(CART_KEY, c); updateBadge(); }
  function addToCart(sku, qty){
    qty = Math.max(1, Math.min(9999, parseInt(qty, 10) || 1));
    var c = cart(), f = c.filter(function(l){ return l.sku === sku; })[0];
    if(f) f.qty = Math.min(9999, f.qty + qty); else c.push({ sku:sku, qty:qty });
    saveCart(c);
  }
  function setQty(sku, qty){
    qty = parseInt(qty, 10) || 0;
    var c = cart().map(function(l){ if(l.sku === sku) l.qty = Math.min(9999, qty); return l; }).filter(function(l){ return l.qty > 0; });
    saveCart(c);
  }
  function cartCount(){ return cart().reduce(function(a, l){ return a + l.qty; }, 0); }
  function updateBadge(){ $$(".cart-count").forEach(function(b){ b.textContent = cartCount(); }); }
  function totals(lines){ /* lines: [{qty, unit}] → {sub:number|null} */
    var sub = 0, unknown = false;
    lines.forEach(function(l){ if(l.unit == null) unknown = true; else sub += l.unit * l.qty; });
    return { sub: unknown || !lines.length ? (lines.length ? null : 0) : Math.round(sub * 100) / 100 };
  }
  function lineTotal(unit, qty){ return unit == null ? null : Math.round(unit * qty * 100) / 100; }

  /* ---------------- orders ---------------- */
  var ORD_KEY = "wws_orders", SEQ_KEY = "wws_order_seq";
  function orders(){ return readJSON(ORD_KEY, []); }
  function nextOrderId(){ var n = (parseInt(LS.getItem(SEQ_KEY), 10) || 0) + 1; LS.setItem(SEQ_KEY, String(n)); return "WWS-DRAFT-" + ("000" + n).slice(-4); }

  /* ---------------- page renderers ---------------- */
  var pages = {};

  pages.catalog = function(){
    $$("[data-price-for]").forEach(function(el){
      var p = CAT.products.filter(function(x){ return x.id === el.getAttribute("data-price-for"); })[0];
      var vals = p.variants.map(function(v){ return price(v.sku); });
      var known = vals.filter(function(v){ return v != null; });
      el.innerHTML = known.length === vals.length ? (Math.min.apply(null, known) === Math.max.apply(null, known) ? money.format(known[0]) : "From " + money.format(Math.min.apply(null, known))) + ' <small>' + esc(p.unit) + '</small>'
                   : '<span class="tbd">Price TBD</span>';
    });
    var tb = $("#sku-table tbody");
    if(tb){ tb.innerHTML = CAT.products.map(function(p){ return p.variants.map(function(v){
      return '<tr><td><code>' + esc(v.sku) + '</code></td><td><a href="' + esc(p.page) + '">' + esc(p.name) + '</a></td><td>' + (v.swatch ? '<span class="sw" style="background:' + esc(v.swatch) + '"></span>' : '') + esc(v.label) + '</td><td>' + fmt(price(v.sku)) + '</td></tr>'; }).join(""); }).join(""); }
  };

  pages.product = function(){
    var p = CAT.products.filter(function(x){ return x.id === document.body.getAttribute("data-product"); })[0];
    var sel = p.variants[0].sku;
    var picker = $("#variant-picker");
    function show(){
      var v = BY_SKU[sel].variant;
      $("#sel-label").textContent = v.label; $("#sel-sku").textContent = v.sku;
      $("#sel-price").innerHTML = fmt(price(sel)) + (price(sel) != null ? ' <small>' + esc(p.unit) + '</small>' : '');
      $$("#variant-picker [data-sku]").forEach(function(b){ var on = b.getAttribute("data-sku") === sel; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
      var q = parseInt($("#qty").value, 10) || 1; var u = price(sel);
      $("#line-preview").innerHTML = "Line total: " + fmtTotal(lineTotal(u, q));
    }
    picker.addEventListener("click", function(e){ var b = e.target.closest("[data-sku]"); if(b){ sel = b.getAttribute("data-sku"); show(); } });
    $("#qty").addEventListener("input", show);
    $("#add").addEventListener("click", function(){
      var q = parseInt($("#qty").value, 10);
      if(!(q >= 1)){ $("#added").innerHTML = '<span class="err">Enter a quantity of 1 or more.</span>'; return; }
      addToCart(sel, q);
      $("#added").innerHTML = '✓ Added ' + q + ' × ' + esc(p.name) + ' – ' + esc(BY_SKU[sel].variant.label) + ' to your cart. <a href="cart.html">View cart →</a>';
    });
    show();
  };

  pages.cart = function(){
    function render(){
      var c = cart(), box = $("#cart");
      if(!c.length){ box.innerHTML = '<div class="empty">Your cart is empty. <a href="catalog.html">Browse the catalog →</a></div>'; $("#to-checkout").classList.add("hidden"); return; }
      $("#to-checkout").classList.remove("hidden");
      var lines = c.map(function(l){ return { qty:l.qty, unit:price(l.sku), sku:l.sku }; });
      box.innerHTML = '<table class="specs cart-table"><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Qty</th><th>Line total</th><th></th></tr></thead><tbody>' +
        lines.map(function(l){ var x = BY_SKU[l.sku];
          return '<tr data-sku="' + esc(l.sku) + '"><td data-l="Product"><a href="' + esc(x.product.page) + '"><strong>' + esc(x.product.name) + '</strong></a><br><small>' + esc(x.variant.label) + '</small></td><td data-l="SKU"><code>' + esc(l.sku) + '</code></td><td data-l="Unit price">' + fmt(l.unit) +
            '</td><td data-l="Qty"><input type="number" min="0" max="9999" step="1" value="' + l.qty + '" class="cq" aria-label="Quantity for ' + esc(l.sku) + '"></td><td data-l="Line total">' + fmtTotal(lineTotal(l.unit, l.qty)) +
            '</td><td><button type="button" class="link rm">Remove</button></td></tr>'; }).join("") +
        '</tbody><tfoot><tr><th colspan="4" style="text-align:right">Subtotal</th><td colspan="2" id="subtotal">' + fmtTotal(totals(lines).sub) + '</td></tr></tfoot></table>' +
        '<p class="form-note">Shipping, tax and lead time <span class="tbd">[TBD]</span>. Prices come from data/prices.json (source: ' + esc(priceSource) + ').</p>';
    }
    $("#cart").addEventListener("change", function(e){ if(e.target.classList.contains("cq")){ setQty(e.target.closest("tr").getAttribute("data-sku"), e.target.value); render(); } });
    $("#cart").addEventListener("click", function(e){ if(e.target.classList.contains("rm")){ setQty(e.target.closest("tr").getAttribute("data-sku"), 0); render(); } });
    render();
  };

  pages.checkout = function(){
    var me = WWSAuth.current(), c = cart(), f = $("#checkout");
    if(!c.length){ $("#co-wrap").innerHTML = '<div class="empty">Your cart is empty, so there is nothing to check out. <a href="catalog.html">Browse the catalog →</a></div>'; return; }
    var lines = c.map(function(l){ return { qty:l.qty, unit:price(l.sku), sku:l.sku }; });
    $("#co-summary").innerHTML = '<table class="specs"><tbody>' + lines.map(function(l){ var x = BY_SKU[l.sku];
      return '<tr><td>' + l.qty + ' × ' + esc(x.product.name) + '<br><small>' + esc(x.variant.label) + ' · <code>' + esc(l.sku) + '</code></small></td><td style="text-align:right">' + fmtTotal(lineTotal(l.unit, l.qty)) + '</td></tr>'; }).join("") +
      '</tbody><tfoot><tr><th>Subtotal</th><td style="text-align:right">' + fmtTotal(totals(lines).sub) + '</td></tr><tr><th>Shipping / tax</th><td style="text-align:right"><span class="tbd">[TBD]</span></td></tr></tfoot></table>';
    var s = me.ship || {};
    var pre = { facility:me.facility, contact:me.name, email:me.email, phone:me.phone, line1:s.line1, line2:s.line2, city:s.city, state:s.state, zip:s.zip };
    Object.keys(pre).forEach(function(k){ if(f.elements[k]) prefill(f.elements[k], pre[k]); });
    f.addEventListener("input", function(e){ e.target.classList.remove("invalid"); if(!f.querySelector(".invalid")) $("#co-err").textContent = ""; });
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var req = ["facility","contact","line1","city","state","zip"], bad = [];
      req.forEach(function(k){ var el = f.elements[k]; var v = el.value.trim(); el.classList.toggle("invalid", !v); if(!v) bad.push(el.getAttribute("data-label")); });
      $("#co-err").textContent = "";
      if(bad.length){ $("#co-err").textContent = "Please fill in: " + bad.join(", ") + "."; return; }
      var c2 = cart(); if(!c2.length){ location.href = "cart.html"; return; }
      var ln = c2.map(function(l){ var x = BY_SKU[l.sku]; return { sku:l.sku, product:x.product.name, variant:x.variant.label, qty:l.qty, unit:price(l.sku) }; });
      var v = function(k){ return f.elements[k].value.trim(); };
      var order = { id: nextOrderId(), created: new Date().toISOString(), member: me.username,
        facility: v("facility"), contact: v("contact"), email: v("email"), phone: v("phone"),
        ship: { line1:v("line1"), line2:v("line2"), city:v("city"), state:v("state"), zip:v("zip") },
        po: v("po"), notes: v("notes"), lines: ln, subtotal: totals(ln).sub, priceSource: priceSource,
        status: "Submitted (demo – stored in this browser only)" };
      var all = orders(); all.push(order); writeJSON(ORD_KEY, all);
      if(f.elements.saveship.checked){ me.facility = order.facility; me.ship = order.ship; if(order.phone) me.phone = order.phone; WWSAuth.saveProfile(me); }
      saveCart([]);
      location.href = "confirmation.html?order=" + encodeURIComponent(order.id);
    });
  };

  function orderDetail(o){
    return '<div class="order-grid"><div><h3>Ship to</h3><p>' + esc(o.facility) + '<br>Attn: ' + esc(o.contact) + '<br>' + esc(o.ship.line1) + (o.ship.line2 ? '<br>' + esc(o.ship.line2) : '') + '<br>' + esc(o.ship.city) + ', ' + esc(o.ship.state) + ' ' + esc(o.ship.zip) + '</p>' +
      (o.phone || o.email ? '<p><small>' + esc([o.phone, o.email].filter(Boolean).join(" · ")) + '</small></p>' : '') +
      (o.po ? '<p><strong>PO / reference:</strong> ' + esc(o.po) + '</p>' : '') + (o.notes ? '<p><strong>Notes:</strong> ' + esc(o.notes) + '</p>' : '') + '</div>' +
      '<div><h3>Items</h3><table class="specs"><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead><tbody>' + o.lines.map(function(l){
        return '<tr><td>' + esc(l.product) + '<br><small>' + esc(l.variant) + ' · <code>' + esc(l.sku) + '</code></small></td><td>' + l.qty + '</td><td>' + fmt(l.unit) + '</td><td>' + fmtTotal(lineTotal(l.unit, l.qty)) + '</td></tr>'; }).join("") +
      '</tbody><tfoot><tr><th colspan="3">Subtotal</th><td>' + fmtTotal(o.subtotal) + '</td></tr></tfoot></table></div></div>';
  }

  pages.confirmation = function(){
    var id = new URLSearchParams(location.search).get("order");
    var o = orders().filter(function(x){ return x.id === id; })[0];
    if(!o){ $("#conf").innerHTML = '<div class="empty">Order not found in this browser. <a href="orders.html">See order history →</a></div>'; return; }
    $("#conf").innerHTML = '<div class="confirm-box"><div class="eyebrow">Order received (demo)</div><h2>Thank you – order ' + esc(o.id) + '</h2>' +
      '<p>Placed ' + esc(new Date(o.created).toLocaleString()) + ' by ' + esc(o.member) + ' for <strong>' + esc(o.facility) + '</strong>. Status: ' + esc(o.status) + '.</p>' +
      '<p class="pricing-note">DEMO ONLY – this order was saved in this browser\'s localStorage. Nothing was sent, no email went out and no one was charged.</p></div>' + orderDetail(o) +
      '<p style="margin-top:24px"><a class="btn" href="orders.html">View order history</a> &nbsp; <a class="btn btn-outline" href="catalog.html">Back to catalog</a></p>';
  };

  pages.orders = function(){
    var mine = orders().filter(function(o){ return o.member === WWSAuth.current().username; }).reverse();
    var tb = $("#orders tbody");
    if(!mine.length){ tb.innerHTML = '<tr><td colspan="6" class="empty-cell">No orders yet. <a href="catalog.html">Start an order →</a></td></tr>'; return; }
    tb.innerHTML = mine.map(function(o){ var n = o.lines.reduce(function(a, l){ return a + l.qty; }, 0);
      return '<tr><td data-l="Order #"><a href="confirmation.html?order=' + encodeURIComponent(o.id) + '"><strong>' + esc(o.id) + '</strong></a></td><td data-l="Date">' + esc(new Date(o.created).toLocaleString()) + '</td><td data-l="Facility">' + esc(o.facility) + '</td><td data-l="Items">' + n + ' item' + (n === 1 ? '' : 's') + '<br><small>' + o.lines.map(function(l){ return esc(l.qty + ' × ' + l.product + ' (' + l.variant + ')'); }).join('<br>') + '</small></td><td data-l="Total">' + fmtTotal(o.subtotal) + '</td><td data-l="Status">' + esc(o.status) + '</td></tr>'; }).join("");
  };

  pages.account = function(){
    var me = WWSAuth.current(), f = $("#acct");
    $("#profile").innerHTML = [["Username", me.username], ["Name", me.name], ["Role", me.role], ["Account type", "Demo account (membership by invitation)"]].map(function(r){ return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join("");
    var s = me.ship || {};
    var pre = { facility:me.facility, city:me.city, state:me.state, phone:me.phone, email:me.email, line1:s.line1, line2:s.line2, scity:s.city, sstate:s.state, zip:s.zip };
    Object.keys(pre).forEach(function(k){ prefill(f.elements[k], pre[k]); });
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var v = function(k){ return f.elements[k].value.trim(); };
      if(!v("facility")){ f.elements.facility.classList.add("invalid"); $("#saved").innerHTML = '<span class="err">Facility name is required.</span>'; return; }
      me.facility = v("facility"); me.city = v("city"); me.state = v("state"); me.phone = v("phone"); me.email = v("email");
      me.ship = { line1:v("line1"), line2:v("line2"), city:v("scity"), state:v("sstate"), zip:v("zip") };
      WWSAuth.saveProfile(me); f.elements.facility.classList.remove("invalid");
      $("#saved").textContent = "✓ Saved in this browser (demo).";
    });
    $("#reset").addEventListener("click", function(){
      if(!confirm("Clear the demo cart, orders and facility info stored in this browser?")) return;
      [CART_KEY, ORD_KEY, SEQ_KEY].forEach(function(k){ LS.removeItem(k); }); WWSAuth.resetProfile(); location.reload();
    });
  };

  pages.login = function(){
    var f = $("#login");
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var pw = f.elements.password;
      var r = WWSAuth.logIn(f.elements.username.value, pw.value);
      pw.value = ""; /* typed password is cleared and never stored */
      if(!r.ok){ $("#login-err").textContent = r.error; return; }
      var n = new URLSearchParams(location.search).get("next") || "";
      location.href = "members/" + (/^[a-z0-9-]+\.html(\?[A-Za-z0-9=&%_.-]*)?$/.test(n) ? n : "catalog.html");
    });
    if(WWSAuth.current()) $("#already").classList.remove("hidden");
  };

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", function(){
    var so = document.getElementById("signout");
    if(so) so.addEventListener("click", function(e){ e.preventDefault(); WWSAuth.logOut(); location.href = ROOT + "login.html?loggedout=1"; });
    var mb = document.querySelector(".menu"); if(mb) mb.addEventListener("click", function(){ document.querySelector("header.site").classList.toggle("open"); });
    updateBadge();
    var pg = document.body.getAttribute("data-page");
    loadPrices().then(function(){
      var ps = document.getElementById("price-source"); if(ps) ps.textContent = priceSource;
      if(pages[pg]) pages[pg]();
      document.body.setAttribute("data-ready", "1");
    });
  });
  window.WWSApp = { cart:cart, price:price, orders:orders };
})();
