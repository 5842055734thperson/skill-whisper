# Skill Pilot v1: Yazarken Skill Önerisi

* **Yazar:** 5842055734thperson
* **Tarih:** 2026-11-04
* **Ham review raporu:** [goldfish_brainstorm_report.md](goldfish_brainstorm_report.md) (6/6 inceleyici tamamladı; 7 🔴, 13 🟡, 9 🟢)

## Genel Bakış

Kullanıcılar onlarca, hatta binlerce skill yüklüyor. Prompt yazarken doğru skill'i hatırlayıp seçmek zahmetli: bir şey bozuk değil, ama sürtünme var. Skill Pilot v1, Claude Code masaüstü için GitHub'da herkese yayınlanacak bir mod. Kullanıcı yazarken taslağı ucuz bir modele (Haiku) gösterir, yüklü skill'lerden en fazla 3 tanesini kısa gerekçeyle önerir. Kullanıcı birine tıklarsa taslağın başına `/skill-adı` eklenir; tıklamazsa hiçbir şey olmaz. Mod skill'i asla kendisi başlatmaz.

Mevcut v0.2 (`~/.claude/my-mods/skill-pilot`) elle yazılmış ~40 skill'lik Türkçe bir katalogu her turda sistem istemine tablo olarak ekliyor. v1 bunun yerini alır.

## Odak (2026-11-04 kararı)

Kullanıcı üç değeri öne çıkardı; v1 bunlara odaklanır:
1. **Claude doğru skill yüklü olsa bile kendi kafasına göre davranıyor**, özellikle elle başlatılan (`disable-model-invocation`) skill'lerde. Asıl çözülecek sorun bu.
2. **Büyük kataloglarda Claude'un listesi kısaltılıyor.**
3. **Kullanıcı seçimi göndermeden önce görmek istiyor.**

Ek kararlar: Türkçe desteği kapsam dışı; her şey (istemler, açıklamalar, test seti) İngilizce. İlk sürüm yazarken öneri değil, **`/pilot <metin>` komutu**.

## Taban Çizgisi (ölçüldü, 2026-11-04)

Düzenek: [skill-pilot-eval/](skill-pilot-eval/) — 30 İngilizce istek ([prompts.jsonl](skill-pilot-eval/prompts.jsonl)), `claude -p` ile skill-pilot kapalı, Opus 5.5, 143 skill yüklü, en fazla 2 tur, değişiklik yapan araçlar kapalı. Tek çalıştırma (n=1), varyans ölçülmedi.

| Grup | Sonuç |
|---|---|
| Model tarafından başlatılabilen skill gerektiren 16 istek | **8/16** doğru skill çağrıldı (teardown, better-colors, remove-animations, seo-audit, deploy-to-vercel, docx, break-ui, mobile-native) |
| Yalnızca elle başlatılan skill gerektiren 4 istek (egm-brainstorm, egm-draft, egm-review, variant) | **0/4** — Claude bir kez bile "bunun için `/egm-brainstorm` var" demedi; işi kendisi yaptı |
| Skill gerektirmeyen 10 istek | **10/10** sessiz kaldı (yanlış alarm yok) |

Kaçırılan 8 isteğin dökümü:
- **4'ünde işi kendisi yaptı:** flowchart'ı düz Mermaid olarak yazdı (diagram-design), erişilebilirliği kendisi inceledi (better-accessibility), metni kendisi yeniden yazdı (humanizer), Bloom filter'ı kendisi anlattı (learn).
- **3'ünde ortamın Artifact kuralı skill'in önüne geçti** (grafik, açılış sayfası, slayt: Artifact `quickstart` çağrıldı). Bu, ortam talimatı ile skill'in çakışması; Claude'un "keyfi" davranışı sayılmamalı ama kullanıcı açısından sonuç aynı: istenen skill çalışmadı.
- **1'inde dosya aradı** (modal animasyonu; boş klasörde dosya yoktu).

**Katalog kısaltması (ölçüldü):** `/context` çıktısına göre listelenen 125 skill'in **53'ü yalnızca adıyla, açıklamasız** modele gidiyor; skill listesinin bütçesi ~10k token ve dolu. Açıklaması düşenler: `humanizer`, `pdf`, `pptx`, `ui-ux-pro-max:*` (slides dahil), `learning-framework:*`, `claude-seo:*` çoğu, `frontend-design`, `deep-research` vb. Kaçırılan "kendisi yaptı" vakalarından ikisi (humanizer, learn) açıklamasız listede. Örnek küçük; ilişki gösterilmiş sayılmaz.

**Sonuç:** "20'de 18" hedefi tabanın açıkça üstünde (taban: 8/20, elle başlatılanlarda 0/4). Sessiz kalma zaten 10/10; pilot bunu bozmamalı.

## Analiz

### Asıl soru: Claude zaten bunu yapmıyor mu?
Claude Code yüklü skill'lerin açıklamalarını ana modele zaten veriyor ve model skill'i kendisi seçiyor. Pilot'un değeri ancak şu durumlarda var:
- Model skill'i kendiliğinden başlatamıyorsa (`disable-model-invocation: true` olan skill'ler; örnek: egm skill'leri).
- Katalog o kadar büyükse ki Claude'un kendi listesi kısaltılıyor.
- Kullanıcı seçimi **göndermeden önce** görmek istiyorsa.

Bu yüzden başarı ölçütü "20'de 18" değil, "eklentisiz Claude'u X kadar geçiyor" olmalı. Önce 30 istek eklentisiz çalıştırılıp bir taban çizgisi alınmalı. En ucuz ilk deneme: skill açıklamalarını iyileştirmek.

### Gösterim yeri (doğrulandı)
- `$.prompt.suggest` (Tab ile kabul edilen soluk öneri) kutuda metin varken çekirdek tarafından gizleniyor. Yazarken öneri için kullanılamaz.
- `prompt.autocomplete` satırı seçilince yalnızca imleçteki kelimenin yerine yazıyor; amaca uymuyor.
- Pane yalnızca geniş pencerede (≈144+ sütun) görünüyor.
- **Ana yüzey: istem kutusunun üstündeki `AbovePrompt` bandı.** Pane isteğe bağlı detay görünümü, `$.ui.status` yedek.

### Tıklama taslağı siliyor (mevcut hata)
v0.2'de `register.tsx:141` `fill({ text: '/ad ', mode: 'replace' })` çağırıyor: yazılmış taslak siliniyor. Başa ekleme modu yok. Düzeltme: `$.prompt.read()` ile taslağı al, baştaki `/komut` varsa çıkar, `'/ad ' + kalan` ile değiştir. `isFilled: false` dönerse toast göster. Bu bir kabul testi olmalı.

### Diller arası eşleşme
Türkçe istek ile İngilizce açıklama arasında anahtar kelime araması neredeyse hiç örtüşme bulmaz. Host'ta embedding API'si yok. Karar:
- ~150–200 skill'e kadar: tüm katalog tek, önbelleklenmiş blok olarak Haiku'ya gider; ön eleme yok.
- Daha fazlası: anahtar kelime ön elemesi, isteğe bağlı olarak her skill için bir kez üretilen çok dilli anahtar kelimelerle.
- v1'de embedding ve yerel model yok.

### Yazma hızı
`prompt.edit` her tuş grubunda çalışır. Model çağrısı orada beklenirse yazma donar. Kanca hemen `next(e)` döner; çağrı 600–900 ms bekleme sonrası, kancanın dışında yapılır. Yeni tuşta eski çağrı `signal` ile iptal edilir; eski taslağa ait cevaplar atılır; modun kendi `fill` işlemleri yok sayılır.

### Maliyet ve gizlilik
- Gönderilmemiş taslaklar kullanıcının kotasıyla modele gidiyor. README'de açıkça yazılmalı; model adımı açık bir onayla (opt-in) ya da görünür bir işaretle çalışmalı.
- Çağrı koşulları: ~800 ms durgunluk, en az 3–4 kelime, `/` ile başlamıyor, tur çalışmıyor, önbellekte yok. Dakikalık ve günlük üst sınır; `effort: low`, `maxTokens ≈ 200`, zaman aşımı 3–4 sn.
- Gizli anahtar gibi görünen taslaklar gönderilmez.
- `haiku` takma adı Bedrock/Vertex/gateway'de çözülmezse model adımı o oturum için kapanır ve bu kullanıcıya gösterilir.

### Skill listesi
Klasör taramak yerine `$.command.list()` kullanılır: çözülmüş `plugin:skill` adlarını ve açık/kapalı durumunu verir. Klasör taraması yalnızca CLI/test aracında kalır (her plugin'in yalnızca en yeni sürümü). Liste oturum başında kurulur, gerektiğinde tazelenir, `/pilot-reindex` ile elle yenilenir.

### "Hiçbir şey önerme"
Model katı JSON döner: en fazla 3 seçim, her birinin güven puanı; boş liste geçerli. Adlar katalogla doğrulanır. Başlangıç eşiği ≈0.6. JSON bozuksa hiçbir şey gösterilmez. "Skill gerekmiyor" ile "öneri servisi çalışmıyor" farklı gösterilir. Öneri listesi yalnızca en üst seçim değişince güncellenir (titreme olmasın).

### Prompt injection
Üçüncü taraf skill açıklamaları modeli yönlendirmeye çalışabilir. Açıklamalar ayraçlar içine alınır, her biri ~300 karakterle sınırlanır, seçimler katalogla doğrulanır.

### Neden önerildiğini görmek
Her öneri satırı gerekçeyi ve kaynağı gösterir. "Neden?" görünümü adayları listeler. Taslak metni değil, yalnızca özetleri (hash) tutan yerel bir iz kaydı; `/pilot-debug`; CLI'da `--explain`. `skill.prompt` olayı ile önerilen skill'in gerçekten kullanılıp kullanılmadığı sayılır.

### Bakım
Host API'si değişebilir: mümkün olan en az API kullanılır, her biri açılışta varlığı kontrol edilir, en düşük Claude Code sürümü belirtilir. "Her masaüstü agent'ı" için bir adaptör çatısı şimdilik yazılmaz.

## Hedefler ve Hedef Dışı

* **Hedefler:**
  - v1: `/pilot <metin>` komutu ile en fazla 3 skill önerisi (elle başlatılanlar ve açıklaması kısaltılanlar dahil). Yazarken `AbovePrompt` bandında öneri v2'de.
  - Tıklayınca taslağı silmeden başa `/skill-adı` ekleme.
  - Otomatik skill listesi (`$.command.list()`); elle katalog yok.
  - Gerekmeyen yerde hiçbir şey önermemek.
  - Açık maliyet/gizlilik bildirimi, üst sınırlar, kapatma.
  - Tek saf fonksiyon `rank(taslak, skill'ler, complete)` + test aracı olarak CLI.
  - v0.2'den temiz geçiş.
* **Hedef dışı (v1):**
  - Skill'i otomatik başlatmak.
  - Codex, Cursor vb. için adaptörler.
  - Embedding veya yerel model.
  - Sistem istemine yönlendirme tablosu eklemek.
  - Telemetrinin bir sunucuya gönderilmesi.

## Değerlendirilen Alternatifler

- **Gönderdikten sonra analiz edip kullanıcıya sormak:** Ana modeli bekletir (her mesaja 1–3 sn) ya da fazladan bir tur harcar. Reddedildi; yazarken öneri seçildi.
- **v0.2'deki gibi sistem istemine tablo eklemek:** Her turda token harcar, binlerce skill'e ölçeklenmez, Claude'un kendi seçimiyle çakışır. Reddedildi.
- **Yalnızca yerel anahtar kelime/BM25 araması:** Ucuz ama Türkçe istek ile İngilizce açıklamayı eşleştiremiyor. Tek başına reddedildi; yalnızca büyük kataloglarda ön eleme olarak duruyor.
- **Embedding araması:** Host'ta embedding API'si yok; ek bağımlılık getirir. v1'den çıkarıldı.
- **Yerel model (Ollama):** Gizlilik açısından iyi ama yeni başlayan biri kuramaz. v1'den çıkarıldı.
- **`$.prompt.suggest` / `prompt.autocomplete` / yalnızca pane:** Yazarken çalışmıyor ya da dar pencerede görünmüyor (yukarıya bakın). `AbovePrompt` bandı seçildi.
- **`$.model.classify`:** Gerekçe ve "hiçbiri" seçeneği için `complete` + katı JSON daha uygun.
- **Baştan host'tan bağımsız adaptör çatısı:** Erken soyutlama. Tek saf fonksiyon yeterli.
- **Daha ucuz ilk deneme (henüz karar verilmedi):** Yazarken değil, yalnızca `/pilot <metin>` komutuyla istek üzerine öneri. Fikri en az kodla test eder.

## Kararlar ve Sonraki Adımlar

1. **Taban çizgisi ölçüldü** (yukarıda): 8/20, elle başlatılanlarda 0/4, sessizlik 10/10. Kalan iş: 3 çalıştırmanın medyanı, başkalarının yazdığı istekler, yakın-ıska negatifler. Türkçe istek gerekmiyor.
2. Başarı ölçütü: `/pilot <metin>` için ilk 3'te doğru skill ≥18/20 (elle başlatılanlar dahil) + gerekmeyenlerde "skill gerekmiyor" ≥9/10. Gecikme ve maliyet de kaydedilir.
3. v1 = `/pilot <metin>` komutu: `$.command.list()` ile tüm skill'ler (açıklaması kısaltılanlar ve elle başlatılanlar dahil) + Haiku ile en fazla 3 öneri + tıklayınca taslağın başına `/skill`. Yazarken öneri v2'ye kaldı.
3. v0.2 geçişi: `CATALOG`, `ROUTES`, `SECTION` ve `prompt.compose` kancası silinir. Yeni ayar yeni anahtarda (`enabled`) tutulur, `level` korunur (geri dönüş için). `/pilot`, `/pilot-help`, `/pilot-ui` komutlarının akıbetine karar verilir. `my-mods` kopyası ile yayınlanan plugin aynı anda kurulmaz.
4. **Çalışırken doğrulanacaklar:** `command.list()` çıktısı; Claude'un kendi skill listesinin büyük kataloglarda kısaltılıp kısaltılmadığı; Haiku gecikmesi ve önbellek alt sınırı; mod içinde kanca dışında zamanlayıcı (`$.clock`); sandbox altında `$.fs` erişimi.
5. **Açık soru:** Artifact kuralı ile skill çakıştığında (grafik, sayfa, slayt) pilot hangisini önermeli? Ortam talimatı skill'den önce geliyor; pilot bunu değiştiremez, yalnızca kullanıcıya iki yolu gösterebilir.
