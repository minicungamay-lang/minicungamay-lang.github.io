// Поведінка статичного сайту: улюблені, фільтри, пошук, галочки інгредієнтів
(function(){
  const root = document.body.dataset.root || "";
  const store = { get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},
                  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}} };
  let favs = new Set(store.get("rb-favs", []));
  const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const pad = n => String(n).padStart(3,"0");
  const fmtTime = m => m >= 60 ? (Math.floor(m/60) + " год" + (m%60 ? " " + m%60 + " хв" : "")) : m + " хв";
  const fmtServ = s => /^\d+$/.test(s) ? s + " порц." : s;

  function paintFavs(){
    document.querySelectorAll("[data-fav-count]").forEach(el => { el.textContent = favs.size; el.hidden = !favs.size; });
    document.querySelectorAll(".card[data-no]").forEach(c => { const s = c.querySelector(".star"); if (s) s.hidden = !favs.has(+c.dataset.no); });
    document.querySelectorAll("[data-fav]").forEach(b => { const on = favs.has(+b.dataset.fav);
      b.setAttribute("aria-pressed", on); b.textContent = on ? "★ В улюблених" : "☆ Додати в улюблені"; });
  }
  document.querySelectorAll("[data-fav]").forEach(b => b.addEventListener("click", () => {
    const no = +b.dataset.fav; favs.has(no) ? favs.delete(no) : favs.add(no); store.set("rb-favs", [...favs]); paintFavs();
  }));

  // галочки інгредієнтів
  const boxes = [...document.querySelectorAll(".ing input")], left = document.querySelector("[data-left]");
  boxes.forEach(b => b.addEventListener("change", () => { const k = boxes.filter(x => !x.checked).length; left.textContent = k ? k : "✓ усе готово"; }));

  // фільтр за часом у розділі
  const grid = document.querySelector("[data-filter-grid]");
  if (grid){
    const chips = document.querySelectorAll(".chip[data-t]"), count = document.querySelector("[data-count]");
    const cards = [...grid.children];
    chips.forEach(ch => ch.addEventListener("click", () => {
      const t = +ch.dataset.t; chips.forEach(c => c.setAttribute("aria-pressed", c === ch));
      let shown = 0; cards.forEach(c => { const ok = !t || +c.dataset.min <= t; c.hidden = !ok; shown += ok; });
      count.textContent = `${shown} з ${cards.length}`;
    }));
  }

  // список з даних (улюблені / пошук / випадковий рецепт)
  const holder = document.querySelector("[data-list]"), rnd = document.querySelector("[data-random]");
  if (holder || rnd){
    fetch(root + "assets/recipes.json").then(r => r.json()).then(data => {
      if (rnd) rnd.href = root + data[Math.floor(Math.random()*data.length)].u;
      if (!holder) return;
      const card = r => `<a class="card" href="${root}${r.u}" style="--c:var(--c-${r.c})" data-no="${r.no}">
        ${r.p ? `<div class="pic"><img src="${root}photos/${pad(r.no)}.jpg" alt="${esc(r.n)}" loading="lazy"></div>`
              : `<div class="pic empty" aria-hidden="true"><div class="plate"><span>№ ${pad(r.no)}</span></div><small>фото готується</small></div>`}
        <div class="body"><div class="no"><span>${r.cn} · № ${pad(r.no)}</span><span class="star" hidden>★</span></div>
        <h3>${esc(r.n)}</h3><div class="meta"><span>⏱ ${fmtTime(r.m)}</span><span>${esc(fmtServ(r.s))}</span><span>${r.k} ккал</span>${r.l ? `<span class="lock">🔒 підписка</span>` : ""}</div></div></a>`;
      let list, empty;
      if (holder.dataset.list === "favorites"){
        list = data.filter(r => favs.has(r.no));
        empty = "Тут з’являться рецепти, які ви позначите зірочкою. Відкрийте будь-яку страву й натисніть «Додати в улюблені».";
      } else {
        const q = (new URLSearchParams(location.search).get("q") || "").trim();
        document.querySelectorAll('input[name="q"]').forEach(i => i.value = q);
        // кожне слово запиту шукаємо за основою: «курка» знайде «курячого», «гарбуз» — «гарбуза»
        const stem = w => w.length >= 6 ? w.slice(0, -2) : w.length >= 4 ? w.slice(0, -1) : w;
        const SYN = { "курк": ["куряч"], "куряч": ["курк"], "кур": ["курк", "куряч"], "яйц": ["яєць", "яєч"], "яєць": ["яйц"], "індичк": ["індич"], "індич": ["індичк"], "картопл": ["картопл"], "сметан": ["йогурт"] };
        const words = q.toLowerCase().replace(/[’']/g, "").split(/[\s,]+/).filter(Boolean).map(stem).map(w => [w, ...(SYN[w] || [])]);
        list = words.length ? data.filter(r => { const hay = (r.n + " " + r.i).toLowerCase().replace(/[’']/g, ""); return words.every(vs => vs.some(v => hay.includes(v))); }) : [];
        document.querySelector("[data-search-title]").textContent = q ? `«${q}»: знайдено ${list.length}` : "Пошук рецептів";
        empty = q ? "Нічого не знайдено. Спробуйте назву страви або продукт, наприклад «гарбуз» чи «курка»." : "Введіть назву страви або інгредієнт у поле пошуку вгорі.";
      }
      holder.innerHTML = list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty-state">${empty}</div>`;
      paintFavs();
    }).catch(() => { if (holder) holder.innerHTML = `<div class="empty-state">Не вдалося завантажити рецепти. Оновіть сторінку.</div>`; });
  }
  paintFavs();
})();

// ---------- вхід через Telegram і доступ підписників ----------
(function(){
  const API = document.body.dataset.api, BOT = document.body.dataset.bot;
  if (!API || !BOT) return;
  const KEY = "rb-session";
  const get = () => { try { return localStorage.getItem(KEY); } catch(e) { return null; } };
  const set = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch(e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const boxes = [...document.querySelectorAll("[data-login]")];
  const body = document.querySelector("[data-locked-body]");
  const paywall = document.querySelector(".paywall");

  function say(html){ boxes.forEach(b => { let p = b.querySelector(".login-msg"); if (!p) { p = document.createElement("p"); p.className = "login-msg"; b.prepend(p); } p.innerHTML = html; }); }
  function widget(){
    boxes.forEach(b => {
      if (b.querySelector("script,iframe")) return;
      const s = document.createElement("script");
      s.async = true; s.src = "https://telegram.org/js/telegram-widget.js?22";
      s.setAttribute("data-telegram-login", BOT); s.setAttribute("data-size", "large");
      s.setAttribute("data-radius", "20"); s.setAttribute("data-onauth", "onTelegramAuth(user)");
      b.appendChild(s);
    });
  }
  function logoutLink(name){ return ` <button type="button" class="linkbtn" data-logout>Вийти${name ? " (" + esc(name) + ")" : ""}</button>`; }
  document.addEventListener("click", e => { if (e.target.closest("[data-logout]")) { set(null); location.reload(); } });

  async function api(path, opts = {}){
    const t = get();
    const r = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), ...(t ? { Authorization: "Bearer " + t } : {}) } });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }
  const f1 = v => String(v).replace(".", ",");
  function partsTable(nu){
    if (!nu) return "";
    const row = (a, b) => `<tr><td>${esc(a)}</td><td></td>${b.map(v => `<td>${v}</td>`).join("")}</tr>`;
    const lab = nu.serv[0];
    return `<section class="parts panel"><h2><span>КБЖВ по інгредієнтах</span><span>уся страва</span></h2>
      <div class="parts-scroll"><table><thead><tr><th>Продукт</th><th>г</th><th>ккал</th><th>Б</th><th>Ж</th><th>В</th></tr></thead><tbody>
      ${nu.parts.map(x => `<tr><td>${esc(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${f1(x[3])}</td><td>${f1(x[4])}</td><td>${f1(x[5])}</td></tr>`).join("")}
      </tbody><tfoot>${row("Разом · " + nu.w + " г", nu.total)}${row("На 100 г", nu.per100)}${row(lab[0].toUpperCase() + lab.slice(1), nu.serv.slice(1))}</tfoot></table></div></section>`;
  }
  function renderRecipe(r){
    body.innerHTML = `<div class="panel"><h2><span>Інгредієнти</span><span data-left>${r.ing.length}</span></h2>
      <ul class="ing">${r.ing.map(s => `<li><label><input type="checkbox"><span>${esc(s)}</span></label></li>`).join("")}</ul></div>
      <div class="panel"><h2><span>Приготування</span><span>${r.steps.length} ${r.steps.length < 5 ? "кроки" : "кроків"}</span></h2>
      <ol class="steps">${r.steps.map(s => `<li><span>${esc(s)}</span></li>`).join("")}</ol></div>` + partsTable(r.nu);
    const bx = [...body.querySelectorAll(".ing input")], left = body.querySelector("[data-left]");
    bx.forEach(b => b.addEventListener("change", () => { const k = bx.filter(x => !x.checked).length; left.textContent = k ? k : "✓ усе готово"; }));
    body.hidden = false; if (paywall) paywall.hidden = true;
  }
  async function unlocked(name){
    document.documentElement.classList.add("is-member");
    document.querySelectorAll(".lock, .sub-banner").forEach(el => el.hidden = true);
    document.querySelectorAll("[data-after-login]").forEach(el => { el.hidden = false; });
    if (document.querySelector("[data-after-login]")) { boxes.forEach(b => b.closest(".pw-login") && (b.closest(".pw-login").hidden = true)); return; }
    document.querySelectorAll(".access").forEach(el => { if (el.textContent.includes("🔒")) el.textContent = "✓ Підписка активна: усі рецепти розділу відкриті"; });
    if (body){
      const { status, data } = await api("/api/recipe/" + body.dataset.no);
      if (status === 200) { renderRecipe(data); return; }
    }
    say(`✓ Підписка активна. Відкрийте будь-який закритий рецепт.${logoutLink(name)}`);
  }
  window.onTelegramAuth = async user => {
    say("Перевіряю підписку…");
    try {
      const { status, data } = await api("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(user) });
      if (status !== 200) { say("Не вдалося увійти. Спробуйте ще раз."); return; }
      set(data.token);
      if (data.member) unlocked(data.name);
      else say(`${esc(data.name)}, підписки поки немає. Оформіть її в Telegram і поверніться — рецепти відкриються автоматично.${logoutLink()}`);
    } catch(e) { say("Немає з’єднання з сервером. Спробуйте пізніше."); }
  };
  (async () => {
    if (!get()) { widget(); return; }
    try {
      const { status, data } = await api("/api/me");
      if (status === 200 && data.member) { unlocked(data.name); return; }
      if (status === 200) { say(`${esc(data.name)}, підписки поки немає або вона закінчилась.${logoutLink()}`); return; }
      set(null); widget();
    } catch(e) { widget(); }
  })();
})();
