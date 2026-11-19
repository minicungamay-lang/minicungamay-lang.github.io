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
        <h3>${esc(r.n)}</h3><div class="meta"><span>⏱ ${fmtTime(r.m)}</span><span>${esc(fmtServ(r.s))}</span></div></div></a>`;
      let list, empty;
      if (holder.dataset.list === "favorites"){
        list = data.filter(r => favs.has(r.no));
        empty = "Тут з’являться рецепти, які ви позначите зірочкою. Відкрийте будь-яку страву й натисніть «Додати в улюблені».";
      } else {
        const q = (new URLSearchParams(location.search).get("q") || "").trim();
        document.querySelectorAll('input[name="q"]').forEach(i => i.value = q);
        const ql = q.toLowerCase();
        list = q ? data.filter(r => (r.n + " " + r.i).toLowerCase().includes(ql)) : [];
        document.querySelector("[data-search-title]").textContent = q ? `«${q}»: знайдено ${list.length}` : "Пошук рецептів";
        empty = q ? "Нічого не знайдено. Спробуйте назву страви або продукт, наприклад «гарбуз» чи «курка»." : "Введіть назву страви або інгредієнт у поле пошуку вгорі.";
      }
      holder.innerHTML = list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty-state">${empty}</div>`;
      paintFavs();
    }).catch(() => { if (holder) holder.innerHTML = `<div class="empty-state">Не вдалося завантажити рецепти. Оновіть сторінку.</div>`; });
  }
  paintFavs();
})();
