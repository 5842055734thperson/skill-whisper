export type SkillEntry = {
  name: string
  tr: string
  example: string
  triggers?: readonly string[]
}
export type Group = { title: string; when: string; skills: SkillEntry[]; manual?: true }

// Curated disambiguation hints + Turkish /whisper-help, Pane & while-typing autocomplete catalog.
// Every manual-only skill (disable-model-invocation: true) sits in a `manual: true` group — never in an auto group.
// At runtime, `prompt.compose` and `prompt.autocomplete` filter every group against installed skills.
export const CATALOG: readonly Group[] = [
  {
    title: 'Diyagram, grafik, çizim',
    when: 'Diagram, flowchart, architecture, timeline; chart or dashboard; technical cutaway illustration; slide deck or PowerPoint',
    skills: [
      {
        name: 'diagram-design',
        tr: 'editoryal diyagram (45 tip)',
        example: 'kasa iş akışını döngü diyagramı yap',
        triggers: ['diyagram', 'diagram', 'akis semasi', 'is akisi', 'flowchart', 'mimari sema', 'zaman cizelgesi', 'timeline', 'mermaid'],
      },
      {
        name: 'dataviz',
        tr: 'grafik ve gösterge paneli',
        example: "bu CSV'den çizgi grafik çiz",
        triggers: ['grafik', 'chart', 'dataviz', 'dashboard', 'gosterge paneli', 'cizgi grafik', 'sutun grafik', 'pasta grafik', 'veri gorsellestir', 'plot'],
      },
      {
        name: 'teardown',
        tr: 'nesnenin teknik çizimi',
        example: 'pH sensörünün katmanlarını çiz',
        triggers: ['teknik cizim', 'katmanlarini ciz', 'kesit cizim', 'cutaway', 'exploded view', 'teardown', 'ic yapisini ciz'],
      },
      {
        name: 'ui-ux-pro-max:slides',
        tr: 'HTML sunum',
        example: 'bu sonuçlardan 5 slaytlık sunum yap',
        triggers: ['html sunum', 'slayt', 'sunum yap', 'sunum hazirla', 'slide deck', 'web sunum'],
      },
      {
        name: 'anthropic-skills:pptx',
        tr: 'PowerPoint (.pptx) sunumu',
        example: 'Q3 sonuçlarından 5 slaytlık pptx hazırla',
        triggers: ['pptx', 'powerpoint', 'power point', 'pptx hazirla', 'pptx sunum'],
      },
    ],
  },
  {
    title: 'Sayfa ve arayüz yapma',
    when: 'Build a NEW page or UI. Full designed page: hallmark. Quick or small UI: frontend-design. From a Figma file or image: build-design. Style/palette/font pick or stack-specific UI rules: ui-ux-pro-max. Turn a brand or screenshot into a reusable design skill: hue',
    skills: [
      {
        name: 'hallmark',
        tr: 'kapsamlı, tasarlanmış sayfa',
        example: 'laboratuvar projem için tek sayfalık site tasarla',
        triggers: ['tek sayfalik site', 'landing page', 'kapsamli sayfa', 'tanitim sayfasi', 'site tasarla', 'hallmark'],
      },
      {
        name: 'frontend-design:frontend-design',
        tr: 'hızlı, hafif arayüz',
        example: 'bu araca basit bir arayüz yap',
        triggers: ['basit bir arayuz', 'basit arayuz', 'hizli arayuz', 'hafif arayuz', 'kucuk arayuz', 'frontend-design'],
      },
      {
        name: 'build-design',
        tr: 'Figma/görselden kod',
        example: 'bu ekran görüntüsünü birebir kodla',
        triggers: ['ekran goruntusunu', 'birebir kodla', 'figma', 'gorselden kod', 'screenshot to code', 'build-design'],
      },
      {
        name: 'ui-ux-pro-max:ui-ux-pro-max',
        tr: 'stil, palet, font veritabanı',
        example: 'bilim projesine uygun palet ve font öner',
        triggers: ['palet ve font', 'renk paleti oner', 'font oner', 'stil oner', 'tasarim sistemi oner', 'ui-ux-pro-max'],
      },
      {
        name: 'hue',
        tr: 'markadan tasarım skill’i üret',
        example: 'logumun renklerinden tasarım skill’i yap',
        triggers: ['tasarim skilli', 'logomun renklerinden', 'logumun renklerinden', 'markadan tasarim', 'brand skill'],
      },
    ],
  },
  {
    title: 'Arayüzü inceleme ve iyileştirme',
    when: 'Review or improve an EXISTING UI. Whole-screen review: better-interface. Single aspect: better-accessibility, better-colors, better-typography, better-layout, better-ui. Taste critique: emil-design-eng. Worst-case data: break-ui. Phone feel: mobile-native. Apple-style motion: apple-design',
    skills: [
      {
        name: 'better-interface',
        tr: 'tüm arayüz için sıralı rapor',
        example: 'bu sayfayı baştan sona incele',
        triggers: ['bastan sona incele', 'arayuzu incele', 'sayfayi incele', 'ekrani incele', 'ui audit', 'arayuz raporu'],
      },
      {
        name: 'emil-design-eng',
        tr: 'zevk ve özen eleştirisi',
        example: 'bu sayfayı eleştir, daha özenli yap',
        triggers: ['daha ozenli yap', 'zevk ve ozen', 'tasarim elestirisi', 'sayfayi elestir', 'design critique', 'taste critique'],
      },
      {
        name: 'better-accessibility',
        tr: 'erişilebilirlik (WCAG)',
        example: 'klavyeyle kullanılabiliyor mu?',
        triggers: ['erisilebilirlik', 'accessibility', 'wcag', 'ekran okuyucu', 'screen reader', 'klavyeyle kullan', 'aria'],
      },
      {
        name: 'better-colors',
        tr: 'renk ve kontrast',
        example: 'renk kontrastını kontrol et',
        triggers: ['renk kontrast', 'kontrastini kontrol', 'kontrast kontrol', 'color contrast', 'karanlik mod renk', 'oklch'],
      },
      {
        name: 'better-typography',
        tr: 'yazı ve tipografi',
        example: 'başlıklar dağınık görünüyor',
        triggers: ['tipografi', 'typography', 'basliklar daginik', 'satir araligi', 'font boyutu', 'yazi hiyerarsisi'],
      },
      {
        name: 'better-layout',
        tr: 'yerleşim ve hizalama',
        example: 'dar ekranda düzen bozuluyor',
        triggers: ['dar ekranda duzen', 'duzen bozuluyor', 'hizalama bozuk', 'yerlesim bozuk', 'layout fix', 'bosluk ve hizalama'],
      },
      {
        name: 'better-ui',
        tr: 'köşe, gölge, ikon cilası',
        example: 'butonlar ucuz görünüyor',
        triggers: ['ucuz gorunuyor', 'kose golge', 'ikon cilasi', 'butonlar ucuz', 'visual polish', 'ui polish'],
      },
      {
        name: 'break-ui',
        tr: 'en kötü veriyle dene',
        example: 'bu kartı en kötü verilerle dene',
        triggers: ['en kotu veri', 'uzun metinle dene', 'bos veriyle dene', 'worst case data', 'edge case veri'],
      },
      {
        name: 'mobile-native',
        tr: 'telefonda doğal his',
        example: 'telefonda yanlış hissettiriyor',
        triggers: ['telefonda yanlis', 'telefonda dogal', 'mobil his', 'mobile native', 'dokunmatik alan'],
      },
      {
        name: 'apple-design',
        tr: 'Apple tarzı hareket',
        example: 'sheet ve yay animasyonu tasarla',
        triggers: ['apple tarzi', 'yay animasyonu', 'sheet ve yay', 'spring animation', 'ios tarzi'],
      },
    ],
  },
  {
    title: 'Animasyon',
    when: 'Add, audit, remove or speed up motion; name a motion effect',
    skills: [
      {
        name: 'animate',
        tr: 'yeni animasyon',
        example: 'menüye açılış animasyonu ekle',
        triggers: ['animasyon ekle', 'animasyonu ekle', 'acilis animasyonu', 'gecis animasyonu', 'add animation'],
      },
      {
        name: 'improve-animations',
        tr: 'animasyon denetimi',
        example: 'uygulamanın hareketlerini denetle',
        triggers: ['hareketlerini denetle', 'animasyon denetimi', 'animasyonlari iyilestir', 'audit animations'],
      },
      {
        name: 'remove-animations',
        tr: 'fazlasını at',
        example: 'uygulama yavaş hissettiriyor',
        triggers: ['animasyonlari kaldir', 'fazla animasyon', 'yavas hissettiriyor', 'remove animations'],
      },
      {
        name: 'animation-vocabulary',
        tr: 'efektin adı ne',
        example: 'açılınca zıplayan şeyin adı ne',
        triggers: ['efektin adi ne', 'ziplayan seyin adi', 'animasyon terimi', 'animation vocabulary'],
      },
    ],
  },
  {
    title: 'React ve Vercel',
    when: 'React/Next.js quality, transitions, React Native, deploy or cut Vercel cost',
    skills: [
      {
        name: 'vercel-react-best-practices',
        tr: 'React performansı',
        example: 'bu bileşeni hızlandır',
        triggers: ['react performans', 'bileseni hizlandir', 're-render', 'nextjs performans', 'useeffect'],
      },
      {
        name: 'vercel-composition-patterns',
        tr: 'bileşen mimarisi',
        example: 'bu prop karmaşasını düzenle',
        triggers: ['prop karmasasi', 'boolean prop', 'bilesen mimarisi', 'compound component', 'composition pattern'],
      },
      {
        name: 'deploy-to-vercel',
        tr: 'yayına al',
        example: 'bunu yayına al',
        triggers: ['yayina al', 'vercele yukle', 'vercel deploy', 'deploy to vercel', 'canliya al'],
      },
    ],
  },
  {
    title: 'SEO',
    when: 'SEO audit of a site or page, technical SEO, content, schema, AI search, plan',
    skills: [
      {
        name: 'claude-seo:seo-page',
        tr: 'tek sayfa',
        example: "şu sayfanın SEO'sunu incele: <url>",
        triggers: ['sayfanin seosu', 'sayfa seo', 'on-page seo', 'tek sayfa seo'],
      },
      {
        name: 'claude-seo:seo-audit',
        tr: 'tüm site',
        example: 'sitemin tam SEO denetimi',
        triggers: ['tam seo denetimi', 'sitemin seosu', 'site seo', 'seo audit', 'teknik seo'],
      },
      {
        name: 'claude-seo:seo-geo',
        tr: 'AI aramada görünürlük',
        example: 'ChatGPT aramada görünür müyüm?',
        triggers: ['chatgpt arama', 'ai aramada gorunur', 'perplexity gorunur', 'llms.txt', 'seo geo'],
      },
      {
        name: 'claude-seo:seo-plan',
        tr: 'SEO stratejisi',
        example: 'yeni sitem için SEO planı',
        triggers: ['seo plani', 'seo stratejisi', 'seo yol haritasi'],
      },
    ],
  },
  {
    title: 'Yazı, öğrenme, doküman, kod',
    when: 'Prose review, AI-sounding text, learning a topic, Word/PDF/XLSX documents, code review',
    skills: [
      {
        name: 'better-writing',
        tr: 'arayüz metinleri',
        example: 'bu hata mesajlarını düzelt',
        triggers: ['hata mesajlarini duzelt', 'arayuz metinleri', 'microcopy', 'buton metni', 'ux writing'],
      },
      {
        name: 'writing-guidelines',
        tr: 'yazı denetimi',
        example: 'bu dokümanı incele',
        triggers: ['yazi denetimi', 'dokumani incele', 'metni incele', 'prose review'],
      },
      {
        name: 'anthropic-skills:humanizer',
        tr: 'metni doğallaştır',
        example: 'bu metni doğal yap',
        triggers: ['metni dogallastir', 'metni dogal yap', 'dogallastir', 'yapay zeka dili', 'humanizer', 'ai kokan metin'],
      },
      {
        name: 'anthropic-skills:learn',
        tr: 'bir konuyu öğren',
        example: "bana PCR'ı öğret",
        triggers: ['bana ogret', 'konuyu ogret', 'adim adim ogret', 'teach me'],
      },
      {
        name: 'anthropic-skills:docx',
        tr: 'Word (.docx) dokümanı',
        example: 'bunu Word belgesi olarak yaz',
        triggers: ['docx', 'word belgesi', 'word dokumani', 'word dosyasi'],
      },
      {
        name: 'anthropic-skills:pdf',
        tr: 'PDF okuma / oluşturma',
        example: 'bu PDF tablosunu çıkar',
        triggers: ['pdf', 'pdf tablo', 'pdf oku', 'pdf olustur', 'pdf cikar'],
      },
      {
        name: 'anthropic-skills:xlsx',
        tr: 'Excel / tablo işleme',
        example: 'bu xlsx dosyasını temizle',
        triggers: ['xlsx', 'excel', 'spreadsheet', 'elektronik tablo'],
      },
      {
        name: 'ponytail:ponytail-review',
        tr: 'kod incelemesi',
        example: 'son değişikliği incele',
        triggers: ['son degisikligi incele', 'kod incelemesi', 'degisiklikleri incele', 'code review', 'diff incele'],
      },
    ],
  },
  {
    title: 'Sadece elle çağrılanlar — Arayüz & Animasyon',
    when: 'Component variants or live prototypes, PR interface review, state switcher, breaking scenarios on a temp page, reverse-explaining a UI/effect, picking a frontend library, or reviewing animation craft',
    manual: true,
    skills: [
      {
        name: 'variant',
        tr: 'tasarım varyantları',
        example: '/variant',
        triggers: ['tasarim varyant', 'varyant uret', 'farkli varyantlar', 'component variants'],
      },
      {
        name: 'prototype',
        tr: 'canlı seçicili çoklu prototip',
        example: '/prototype',
        triggers: ['canli prototip', 'coklu prototip', 'secicili prototip', 'interactive prototype'],
      },
      {
        name: 'interface-review',
        tr: 'branch/PR arayüz incelemesi',
        example: '/interface-review',
        triggers: ['pr arayuz incele', 'branch arayuz incele', 'interface review'],
      },
      {
        name: 'state-machine',
        tr: 'bileşen durum makinesi',
        example: '/state-machine',
        triggers: ['durum makinesi', 'state machine', 'state switcher', 'bilesen durumlari'],
      },
      {
        name: 'break',
        tr: 'geçici sayfada stres testi',
        example: '/break',
        triggers: ['gecici sayfada stres', 'stres testi sayfa', 'kirma senaryolari'],
      },
      {
        name: 'explain-interface',
        tr: 'URL/ekran görüntüsünden arayüz analizi',
        example: '/explain-interface',
        triggers: ['arayuz analizi', 'nasil yapildigini acikla', 'explain interface', 'reverse engineer ui'],
      },
      {
        name: 'pick-ui-library',
        tr: 'arayüz kütüphanesi seçimi',
        example: '/pick-ui-library',
        triggers: ['arayuz kutuphanesi', 'ui kutuphanesi', 'kutuphane sec', 'ui library', 'pick-ui-library'],
      },
      {
        name: 'review-animations',
        tr: 'animasyon işçiliği incelemesi',
        example: '/review-animations',
        triggers: ['animasyon isciligi', 'animasyon incelemesi', 'review animations'],
      },
    ],
  },
  {
    title: 'Sadece elle çağrılanlar — Yazılım tasarımı (EGM)',
    when: 'Software idea brainstorming, formal design doc / spec drafting, independent multi-reviewer spec review, automated review loop, doc/code drift detection, review resolution, or directory README bootstrap',
    manual: true,
    skills: [
      {
        name: 'egm:egm-brainstorm',
        tr: 'fikri olgunlaştır',
        example: '/egm:egm-brainstorm',
        triggers: ['fikri olgunlastir', 'beyin firtinasi', 'brainstorm', 'mimari fikir'],
      },
      {
        name: 'egm:egm-draft',
        tr: 'formal spec / tasarım dokümanı taslağı',
        example: '/egm:egm-draft',
        triggers: ['formal spec', 'tasarim dokumani', 'design doc', 'teknik sartname', 'spec taslagi', 'spec yaz'],
      },
      {
        name: 'egm:egm-review',
        tr: 'bağımsız hakemlerle tasarım inceleme',
        example: '/egm:egm-review',
        triggers: ['bagimsiz hakem', 'tasarim inceleme', 'spec incele', 'design doc review'],
      },
      {
        name: 'egm:egm-review-loop',
        tr: 'otomatik tasarım inceleme döngüsü',
        example: '/egm:egm-review-loop',
        triggers: ['inceleme dongusu', 'review loop', 'otomatik inceleme dongusu'],
      },
      {
        name: 'egm:egm-drift-report',
        tr: 'doküman-kod uyumsuzluk raporu',
        example: '/egm:egm-drift-report',
        triggers: ['uyumsuzluk raporu', 'dokuman kod uyumsuz', 'drift report', 'doc code drift'],
      },
      {
        name: 'egm:egm-resolve',
        tr: 'inceleme bulgularını çöz',
        example: '/egm:egm-resolve',
        triggers: ['bulgulari coz', 'inceleme bulgularini', 'resolve findings'],
      },
      {
        name: 'egm:egm-bootstrap',
        tr: 'dizin README kurulumu',
        example: '/egm:egm-bootstrap',
        triggers: ['readme kurulumu', 'dizin readme', 'readme bootstrap'],
      },
    ],
  },
]
