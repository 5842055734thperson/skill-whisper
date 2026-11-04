# Skill Pilot v0.4: Düzeltilmiş Mimari, Mod Doğrulaması ve Dürüst Ölçüm Raporu

**Yazar:** 5842055734thperson (Antigravity ile güncellendi)  
**Tarih:** 2026-11-04  
**Kapsam:** Tüm kod ve çıktılar yalnızca `antigravity/` altındadır; üst dizindeki (`..`) hiçbir dosya değiştirilmemiştir. Asıl kurulabilir eklenti paketi [`skill-pilot/`](skill-pilot/) dizinindedir.

---

## 1. `antigravity_review.md` Bulgularının Çözüm Özeti

Önceki taslakta tespit edilen **6 kod hatasının tamamı** ve **rapordaki metodolojik abartılar** giderildi:

| # | Tespit Edilen Hata (`antigravity_review.md`) | Yapılan Düzeltme | Doğrulama |
|---|---|---|---|
| **1** | `$.prompt.read()` metin değil `{ text, cursor }` döndürdüğü için Pane tıklaması çöküyordu (`.replace is not a function`). | [`register.tsx`](skill-pilot/hooks/register.tsx) içinde `const { text } = await $.prompt.read()` olarak düzeltildi; `isFilled: false` durumunda `$.ui.status` uyarısı eklendi. | `claude plugin test` üzerinde gerçek `<Pane>` mount + `pane.press({ key: 'skill-dataviz' })` ile doğrulandı. |
| **2** | `/pilot-find` kaydedilmişti ama `command.run` işleyicisi yoktu. | Ölü `/pilot-find` kaydı ve yardım satırı tamamen kaldırıldı; yalnızca çalışan `/pilot`, `/pilot-help` ve `/pilot-ui` kayıtlı. | `session.start` testinde kayıtlı komut listesi `['pilot', 'pilot-help', 'pilot-ui']` olarak doğrulandı. |
| **3** | `review-animations` (manuel) otomatik tablodaki Animasyon grubundaydı; 5 manuel skill (`break`, `explain-interface`, `prototype`, `pick-ui-library`, `egm:egm-review-loop`) eksikti. | [`catalog.ts`](skill-pilot/hooks/catalog.ts) içinde 15 manuel skill'in tamamı `manual: true` gruplarına alındı; otomatik tabloda sıfır manuel skill kaldı. Ayrıca [`register.tsx`](skill-pilot/hooks/register.tsx) oturumda kurulu olmayan skill'leri tablodan filtreliyor ve `prompt.attachment` kancası diskteki `SKILL.md` dosyalarından (`disable-model-invocation: true`) manuel skill'leri dinamik keşfediyor. | Hem `claude plugin test` hem de canlı `--plugin-dir` koşusunda (Vaka #106 `pick-ui-library`) doğrulandı. |
| **4** | `lite` modunda Türkçe sabit cümle (`"Bu görev için..."`) kalmıştı; canlı test dil düzeltmesinden önce koşmuştu. | [`logic.ts`](skill-pilot/hooks/logic.ts) içinde hem `full` hem `lite` metinleri tamamen dil-bağımsız (`in the user's language`) yapıldı; sabit Türkçe çıktı şablonu kalmadı. | İngilizce canlı mod testinde (#18 ve #106) yanıtların tamamen İngilizce geldiği doğrulandı. |
| **5** | Testler modun kendisini değil, ayrı bir `pilot_engine.ts` dosyasını test ediyordu. | Kopya taslak dosyalar silindi; tek kaynak [`skill-pilot/hooks/`](skill-pilot/hooks/) oldu. [`register.test.tsx`](skill-pilot/hooks/register.test.tsx) doğrudan `claude plugin test skill-pilot` ile gerçek modu test ediyor (**5/5 geçti**). | `claude plugin validate skill-pilot` (**Validation passed**) + `claude plugin test skill-pilot` (**5 pass, 0 fail**). |
| **6** | `^\/\S+\s*` ifadesi `/etc/hosts changed` gibi dosya yollarını da siliyordu. | [`buildFilledDraft`](skill-pilot/hooks/logic.ts) yalnızca baştaki `/token` bilinen bir komut/skill adıysa (`knownCommands.has(token)`) siliyor; `/etc/hosts` olduğu gibi korunuyor. | `pane.press` testinde `'/etc/hosts changed, explain why'` -> `'/dataviz /etc/hosts changed, explain why'` doğrulandı. |

---

## 2. Birleştirilmemiş, Şeffaf Ölçüm Tablosu

Önceki rapordaki birleştirilmiş `"%100"` ifadesi geri çekilmiştir. Farklı model ve kurulumlarla yapılan ölçümler **birbirine karıştırılmadan** ayrı satırlarda raporlanmıştır:

| Koşul | Model & Kurulum | Yükleme Yöntemi | Kapsam (`n`) | Sonuçlar | Tur Başı Ek Token |
|---|---|---|---|---|---|
| **A: Baseline (`run1`)** | Opus 5.5 · `ponytail` açık · `max-turns 2` | Mod kapalı | 30 vaka (`n=1`) | Auto: 8/16 · Manual: 0/4 · Quiet: 10/10 *(13 koşu 2. turda kesildi)* | 0 |
| **B: v0.3 (`pilot_v03`)** | Opus 5.5 · `ponytail` açık · `max-turns 2` | Kurulu v0.3 mod | 30 vaka (`n=1`) | Auto: 15/16 · Manual: 0/4 · Quiet: 10/10 *(15 koşu 2. turda kesildi)* | ~450 token |
| **Haiku Prototip v2** | Haiku 5.5 · `RULES_V2` + 2 `OVERRIDES` | Harici CLI (`rank.py`) | 30 vaka (`n=1`, test setinde ayarlı) | Auto aday: 15/16 · Manual aday: 3/4 · Quiet: 10/10 *(kullanıcı komutu + ~7.1 sn gecikme gerekir)* | ~13,260 token / çağrı ($0.0027) |
| **C-Prompt Ön Denemesi** | Sonnet 5.5 · `ponytail` kapalı · `strict-mcp` | `--append-system-prompt` (modsuz) | Yalnızca 6 açık vaka (#13, #17–20, #31) | #13 `pptx` çağrıldı (1/1) · Manuel önerildi (4/4, Türkçe başlıkla) · CSS yakın-kaçırma sessiz (1/1) | ~685 token |
| **v0.4 Gerçek Mod Duman Testi (`out_mod_smoke`)** | Sonnet 5.5 · `ponytail` kapalı · `strict-mcp` | **Gerçek mod (`--plugin-dir ./skill-pilot`)** | **4 vaka** (2 tablo dışı auto + 2 manuel İngilizce) | **4/4 geçti:** Tablo dışı `ask-sonner` ve `write-swift` çağrıldı; `pick-ui-library` ve `egm:egm-draft` İngilizce önerildi | ~700 token (`compose`) + dinamik `skill_listing` yaması |

### Canlı v0.4 Mod Testinin (`out_mod_smoke`) Kanıtladığı Kritik Nokta
Vaka #106'da (`"Which React library should I pick for accessible command menus and virtualized 50k-row tables?"`), `CATALOG` tablosundaki grup açıklamasında *"command menus"* veya *"virtualization"* kelimeleri **geçmemesine rağmen**, model şu yanıtı verdi:
> `🧭 Skill: /pick-ui-library. It picks a library for a frontend task from a curated, opinionated list, and command menus and virtualization are both on it. I can't invoke it myself...`

Modelin alıntıladığı *"curated, opinionated list... command menus... virtualization"* ifadeleri doğrudan `~/.claude/skills/pick-ui-library/SKILL.md` dosyasının frontmatter açıklamasıdır. Bu, **`on('prompt.attachment')` kancasının diskten `SKILL.md` okuyup `skill_listing` ekini çalışma zamanında başarıyla zenginleştirdiğini (Condition D)** canlı ortamda doğrulamaktadır.

---

## 3. Bilinen Sınırlar ve Henüz Ölçülmeyenler (Açık Kısıtlar)

1. **Tam Karşılaştırılabilir 40 Vakalık Opus Koşusu Henüz Yapılmadı:** Kullanıcının haftalık Claude kotası sınırda olduğu için v0.4 modunun tüm 30 orijinal vaka + 10 yeni tablo dışı vaka ([`held_out_prompts.jsonl`](held_out_prompts.jsonl)) üzerinde Opus + `ponytail` açıkken (`n=3` tekrar ile) karşılaştırmalı ölçümü henüz koşturulmadı. Haftalık kota yenilendiğinde tek komutla çalıştırmak üzere [`run_mod_eval.mjs`](run_mod_eval.mjs) (`node run_mod_eval.mjs --full`) hazır bırakıldı.
2. **Üçüncü Parti Kullanıcılara Yayınlama Notu:**
   * `prompt.compose` artık `$.command.list()` ile kesişim alarak **kullanıcıda kurulu olmayan skill'leri tablodan otomatik çıkarır**.
   * `prompt.attachment` (`skill_listing`) kancası ise kullanıcının kendi `~/.claude/skills` ve `~/.claude/plugins` dizinlerindeki `SKILL.md` dosyalarını tarayarak tablo dışı manuel skill'leri ve kırpılmış açıklamaları dinamik ekler (maks. karakter bütçesi korumalı).
3. **Statik Tip Kontrolü:** Ortamda `tsc` kurulu olmadığı için tam TypeScript derlemesi yerine `claude plugin validate skill-pilot` (statik kanca/izin doğrulayıcısı) ve `claude plugin test skill-pilot` (çalışma zamanı kanca test motoru) çalıştırıldı; ikisi de hatasız geçmektedir.

---

## 4. Kurulum Öncesi Kontrol Listesi ve Dosya Haritası

* [`skill-pilot/.claude-plugin/plugin.json`](skill-pilot/.claude-plugin/plugin.json) — Eklenti manifestosu (v0.4.0).
* [`skill-pilot/hooks/catalog.ts`](skill-pilot/hooks/catalog.ts) — Otomatik ve 15 manuel skill'i doğru ayıran katalog.
* [`skill-pilot/hooks/logic.ts`](skill-pilot/hooks/logic.ts) — `buildFilledDraft` (`/etc/hosts` korumalı), `parseFrontmatter`, `filterGroups`, `buildRouterSection`, `enrichSkillListing`.
* [`skill-pilot/hooks/register.tsx`](skill-pilot/hooks/register.tsx) — Gerçek mod kancaları (`session.start`, `command.run`, `prompt.attachment`, `prompt.compose`, `ui.render`).
* [`skill-pilot/hooks/register.test.tsx`](skill-pilot/hooks/register.test.tsx) — `claude plugin test skill-pilot` ile çalışan 5 kapsamlı mod testi.
* [`held_out_prompts.jsonl`](held_out_prompts.jsonl) & [`run_mod_eval.mjs`](run_mod_eval.mjs) — Tablo dışı 10 yeni test vakası ve `--plugin-dir` tabanlı değerlendirme koşucusu.
