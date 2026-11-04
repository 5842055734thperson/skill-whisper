export type SkillEntry = {
  name: string
  label: string
  example: string
  triggers?: readonly string[]
}
export type Group = { title: string; when: string; skills: SkillEntry[]; manual?: true }

// Curated catalog for the router table, /whisper-help, the pane and while-typing matching.
// `triggers` hold extra words (English and Turkish, folded to ASCII at match time) that point to the skill.
// Every manual-only skill (disable-model-invocation: true) sits in a `manual: true` group — never in an auto group.
// At runtime, `prompt.compose` and `prompt.autocomplete` filter every group against installed skills.
export const CATALOG: readonly Group[] = [
  {
    title: 'Diagrams, charts, drawings',
    when: 'Diagram, flowchart, architecture, timeline; chart or dashboard; technical cutaway illustration; slide deck or PowerPoint',
    skills: [
      {
        name: 'diagram-design',
        label: 'editorial diagram (45 types)',
        example: 'turn the checkout workflow into a loop diagram',
        triggers: ['diyagram', 'diagram', 'akis semasi', 'is akisi', 'flowchart', 'mimari sema', 'zaman cizelgesi', 'timeline', 'mermaid', 'editoryal diyagram (45 tip)', 'kasa iş akışını döngü diyagramı yap'],
      },
      {
        name: 'dataviz',
        label: 'charts and dashboards',
        example: 'draw a line chart from this CSV',
        triggers: ['grafik', 'chart', 'dataviz', 'dashboard', 'gosterge paneli', 'cizgi grafik', 'sutun grafik', 'pasta grafik', 'veri gorsellestir', 'plot', 'grafik ve gösterge paneli', "bu CSV'den çizgi grafik çiz"],
      },
      {
        name: 'teardown',
        label: 'technical drawing of an object',
        example: 'draw the layers of a pH sensor',
        triggers: ['teknik cizim', 'katmanlarini ciz', 'kesit cizim', 'cutaway', 'exploded view', 'teardown', 'ic yapisini ciz', 'nesnenin teknik çizimi', 'pH sensörünün katmanlarını çiz'],
      },
      {
        name: 'ui-ux-pro-max:slides',
        label: 'HTML slide deck',
        example: 'make a 5-slide deck from these results',
        triggers: ['html sunum', 'slayt', 'sunum yap', 'sunum hazirla', 'slide deck', 'web sunum', 'HTML sunum', 'bu sonuçlardan 5 slaytlık sunum yap'],
      },
      {
        name: 'anthropic-skills:pptx',
        label: 'PowerPoint (.pptx) deck',
        example: 'make a 5-slide pptx from the Q3 results',
        triggers: ['pptx', 'powerpoint', 'power point', 'pptx hazirla', 'pptx sunum', 'PowerPoint (.pptx) sunumu', 'Q3 sonuçlarından 5 slaytlık pptx hazırla'],
      },
    ],
  },
  {
    title: 'Building pages and UI',
    when: 'Build a NEW page or UI. Full designed page: hallmark. Quick or small UI: frontend-design. From a Figma file or image: build-design. Style/palette/font pick or stack-specific UI rules: ui-ux-pro-max. Turn a brand or screenshot into a reusable design skill: hue',
    skills: [
      {
        name: 'hallmark',
        label: 'full, designed page',
        example: 'design a one-page site for my lab project',
        triggers: ['tek sayfalik site', 'landing page', 'kapsamli sayfa', 'tanitim sayfasi', 'site tasarla', 'hallmark', 'kapsamlı, tasarlanmış sayfa', 'laboratuvar projem için tek sayfalık site tasarla'],
      },
      {
        name: 'frontend-design:frontend-design',
        label: 'quick, light UI',
        example: 'make a simple UI for this tool',
        triggers: ['basit bir arayuz', 'basit arayuz', 'hizli arayuz', 'hafif arayuz', 'kucuk arayuz', 'frontend-design', 'hızlı, hafif arayüz', 'bu araca basit bir arayüz yap'],
      },
      {
        name: 'build-design',
        label: 'code from Figma or an image',
        example: 'code this screenshot exactly',
        triggers: ['ekran goruntusunu', 'birebir kodla', 'figma', 'gorselden kod', 'screenshot to code', 'build-design', 'Figma/görselden kod', 'bu ekran görüntüsünü birebir kodla'],
      },
      {
        name: 'ui-ux-pro-max:ui-ux-pro-max',
        label: 'styles, palettes, fonts database',
        example: 'suggest a palette and fonts for a science project',
        triggers: ['palet ve font', 'renk paleti oner', 'font oner', 'stil oner', 'tasarim sistemi oner', 'ui-ux-pro-max', 'stil, palet, font veritabanı', 'bilim projesine uygun palet ve font öner'],
      },
      {
        name: 'hue',
        label: 'make a design skill from a brand',
        example: "make a design skill from my logo's colors",
        triggers: ['tasarim skilli', 'logomun renklerinden', 'logumun renklerinden', 'markadan tasarim', 'brand skill', 'markadan tasarım skill’i üret', 'logumun renklerinden tasarım skill’i yap'],
      },
    ],
  },
  {
    title: 'Reviewing and improving UI',
    when: 'Review or improve an EXISTING UI. Whole-screen review: better-interface. Single aspect: better-accessibility, better-colors, better-typography, better-layout, better-ui. Taste critique: emil-design-eng. Worst-case data: break-ui. Phone feel: mobile-native. Apple-style motion: apple-design',
    skills: [
      {
        name: 'better-interface',
        label: 'ranked report for the whole UI',
        example: 'review this page end to end',
        triggers: ['bastan sona incele', 'arayuzu incele', 'sayfayi incele', 'ekrani incele', 'ui audit', 'arayuz raporu', 'tüm arayüz için sıralı rapor', 'bu sayfayı baştan sona incele'],
      },
      {
        name: 'emil-design-eng',
        label: 'taste and craft critique',
        example: 'critique this page and make it more polished',
        triggers: ['daha ozenli yap', 'zevk ve ozen', 'tasarim elestirisi', 'sayfayi elestir', 'design critique', 'taste critique', 'zevk ve özen eleştirisi', 'bu sayfayı eleştir, daha özenli yap'],
      },
      {
        name: 'better-accessibility',
        label: 'accessibility (WCAG)',
        example: 'can it be used with the keyboard?',
        triggers: ['erisilebilirlik', 'accessibility', 'wcag', 'ekran okuyucu', 'screen reader', 'klavyeyle kullan', 'aria', 'erişilebilirlik (WCAG)', 'klavyeyle kullanılabiliyor mu?'],
      },
      {
        name: 'better-colors',
        label: 'color and contrast',
        example: 'check the color contrast',
        triggers: ['renk kontrast', 'kontrastini kontrol', 'kontrast kontrol', 'color contrast', 'karanlik mod renk', 'oklch', 'renk ve kontrast', 'renk kontrastını kontrol et'],
      },
      {
        name: 'better-typography',
        label: 'text and typography',
        example: 'the headings look messy',
        triggers: ['tipografi', 'typography', 'basliklar daginik', 'satir araligi', 'font boyutu', 'yazi hiyerarsisi', 'yazı ve tipografi', 'başlıklar dağınık görünüyor'],
      },
      {
        name: 'better-layout',
        label: 'layout and alignment',
        example: 'the layout breaks on narrow screens',
        triggers: ['dar ekranda duzen', 'duzen bozuluyor', 'hizalama bozuk', 'yerlesim bozuk', 'layout fix', 'bosluk ve hizalama', 'yerleşim ve hizalama', 'dar ekranda düzen bozuluyor'],
      },
      {
        name: 'better-ui',
        label: 'corners, shadows, icon polish',
        example: 'the buttons look cheap',
        triggers: ['ucuz gorunuyor', 'kose golge', 'ikon cilasi', 'butonlar ucuz', 'visual polish', 'ui polish', 'köşe, gölge, ikon cilası', 'butonlar ucuz görünüyor'],
      },
      {
        name: 'break-ui',
        label: 'try it with worst-case data',
        example: 'try this card with worst-case data',
        triggers: ['en kotu veri', 'uzun metinle dene', 'bos veriyle dene', 'worst case data', 'edge case veri', 'en kötü veriyle dene', 'bu kartı en kötü verilerle dene'],
      },
      {
        name: 'mobile-native',
        label: 'native feel on phones',
        example: 'it feels wrong on my phone',
        triggers: ['telefonda yanlis', 'telefonda dogal', 'mobil his', 'mobile native', 'dokunmatik alan', 'telefonda doğal his', 'telefonda yanlış hissettiriyor'],
      },
      {
        name: 'apple-design',
        label: 'Apple-style motion',
        example: 'design a sheet with spring animation',
        triggers: ['apple tarzi', 'yay animasyonu', 'sheet ve yay', 'spring animation', 'ios tarzi', 'Apple tarzı hareket', 'sheet ve yay animasyonu tasarla'],
      },
    ],
  },
  {
    title: 'Animation',
    when: 'Add, audit, remove or speed up motion; name a motion effect',
    skills: [
      {
        name: 'animate',
        label: 'new animation',
        example: 'add an opening animation to the menu',
        triggers: ['animasyon ekle', 'animasyonu ekle', 'acilis animasyonu', 'gecis animasyonu', 'add animation', 'yeni animasyon', 'menüye açılış animasyonu ekle'],
      },
      {
        name: 'improve-animations',
        label: 'animation audit',
        example: "audit the app's motion",
        triggers: ['hareketlerini denetle', 'animasyon denetimi', 'animasyonlari iyilestir', 'audit animations', 'animasyon denetimi', 'uygulamanın hareketlerini denetle'],
      },
      {
        name: 'remove-animations',
        label: 'remove the excess',
        example: 'the app feels slow',
        triggers: ['animasyonlari kaldir', 'fazla animasyon', 'yavas hissettiriyor', 'remove animations', 'fazlasını at', 'uygulama yavaş hissettiriyor'],
      },
      {
        name: 'animation-vocabulary',
        label: 'name that effect',
        example: "what's the bouncy thing when it opens called",
        triggers: ['efektin adi ne', 'ziplayan seyin adi', 'animasyon terimi', 'animation vocabulary', 'efektin adı ne', 'açılınca zıplayan şeyin adı ne'],
      },
    ],
  },
  {
    title: 'React and Vercel',
    when: 'React/Next.js quality, transitions, React Native, deploy or cut Vercel cost',
    skills: [
      {
        name: 'vercel-react-best-practices',
        label: 'React performance',
        example: 'make this component faster',
        triggers: ['react performans', 'bileseni hizlandir', 're-render', 'nextjs performans', 'useeffect', 'React performansı', 'bu bileşeni hızlandır'],
      },
      {
        name: 'vercel-composition-patterns',
        label: 'component architecture',
        example: 'clean up this prop mess',
        triggers: ['prop karmasasi', 'boolean prop', 'bilesen mimarisi', 'compound component', 'composition pattern', 'bileşen mimarisi', 'bu prop karmaşasını düzenle'],
      },
      {
        name: 'deploy-to-vercel',
        label: 'deploy it',
        example: 'deploy this',
        triggers: ['yayina al', 'vercele yukle', 'vercel deploy', 'deploy to vercel', 'canliya al', 'yayına al', 'bunu yayına al'],
      },
    ],
  },
  {
    title: 'SEO',
    when: 'SEO audit of a site or page, technical SEO, content, schema, AI search, plan',
    skills: [
      {
        name: 'claude-seo:seo-page',
        label: 'single page',
        example: 'review the SEO of this page: <url>',
        triggers: ['sayfanin seosu', 'sayfa seo', 'on-page seo', 'tek sayfa seo', 'tek sayfa', "şu sayfanın SEO'sunu incele: <url>"],
      },
      {
        name: 'claude-seo:seo-audit',
        label: 'whole site',
        example: 'full SEO audit of my site',
        triggers: ['tam seo denetimi', 'sitemin seosu', 'site seo', 'seo audit', 'teknik seo', 'tüm site', 'sitemin tam SEO denetimi'],
      },
      {
        name: 'claude-seo:seo-geo',
        label: 'visibility in AI search',
        example: 'am I visible in ChatGPT search?',
        triggers: ['chatgpt arama', 'ai aramada gorunur', 'perplexity gorunur', 'llms.txt', 'seo geo', 'AI aramada görünürlük', 'ChatGPT aramada görünür müyüm?'],
      },
      {
        name: 'claude-seo:seo-plan',
        label: 'SEO strategy',
        example: 'SEO plan for my new site',
        triggers: ['seo plani', 'seo stratejisi', 'seo yol haritasi', 'SEO stratejisi', 'yeni sitem için SEO planı'],
      },
    ],
  },
  {
    title: 'Writing, learning, documents, code',
    when: 'Prose review, AI-sounding text, learning a topic, Word/PDF/XLSX documents, code review',
    skills: [
      {
        name: 'better-writing',
        label: 'interface copy',
        example: 'fix these error messages',
        triggers: ['hata mesajlarini duzelt', 'arayuz metinleri', 'microcopy', 'buton metni', 'ux writing', 'arayüz metinleri', 'bu hata mesajlarını düzelt'],
      },
      {
        name: 'writing-guidelines',
        label: 'prose review',
        example: 'review this document',
        triggers: ['yazi denetimi', 'dokumani incele', 'metni incele', 'prose review', 'yazı denetimi', 'bu dokümanı incele'],
      },
      {
        name: 'anthropic-skills:humanizer',
        label: 'make text sound natural',
        example: 'make this text sound natural',
        triggers: ['metni dogallastir', 'metni dogal yap', 'dogallastir', 'yapay zeka dili', 'humanizer', 'ai kokan metin', 'metni doğallaştır', 'bu metni doğal yap'],
      },
      {
        name: 'anthropic-skills:learn',
        label: 'learn a topic',
        example: 'teach me PCR',
        triggers: ['bana ogret', 'konuyu ogret', 'adim adim ogret', 'teach me', 'bir konuyu öğren', "bana PCR'ı öğret"],
      },
      {
        name: 'anthropic-skills:docx',
        label: 'Word (.docx) document',
        example: 'write this as a Word document',
        triggers: ['docx', 'word belgesi', 'word dokumani', 'word dosyasi', 'Word (.docx) dokümanı', 'bunu Word belgesi olarak yaz'],
      },
      {
        name: 'anthropic-skills:pdf',
        label: 'read / create PDFs',
        example: 'extract the table from this PDF',
        triggers: ['pdf', 'pdf tablo', 'pdf oku', 'pdf olustur', 'pdf cikar', 'PDF okuma / oluşturma', 'bu PDF tablosunu çıkar'],
      },
      {
        name: 'anthropic-skills:xlsx',
        label: 'Excel / spreadsheet work',
        example: 'clean up this xlsx file',
        triggers: ['xlsx', 'excel', 'spreadsheet', 'elektronik tablo', 'Excel / tablo işleme', 'bu xlsx dosyasını temizle'],
      },
      {
        name: 'ponytail:ponytail-review',
        label: 'code review',
        example: 'review the last change',
        triggers: ['son degisikligi incele', 'kod incelemesi', 'degisiklikleri incele', 'code review', 'diff incele', 'kod incelemesi', 'son değişikliği incele'],
      },
    ],
  },
  {
    title: 'Manual-only — UI and animation',
    when: 'Component variants or live prototypes, PR interface review, state switcher, breaking scenarios on a temp page, reverse-explaining a UI/effect, picking a frontend library, or reviewing animation craft',
    manual: true,
    skills: [
      {
        name: 'variant',
        label: 'design variants',
        example: '/variant',
        triggers: ['tasarim varyant', 'varyant uret', 'farkli varyantlar', 'component variants', 'tasarım varyantları'],
      },
      {
        name: 'prototype',
        label: 'several prototypes behind a live picker',
        example: '/prototype',
        triggers: ['canli prototip', 'coklu prototip', 'secicili prototip', 'interactive prototype', 'canlı seçicili çoklu prototip'],
      },
      {
        name: 'interface-review',
        label: 'branch/PR interface review',
        example: '/interface-review',
        triggers: ['pr arayuz incele', 'branch arayuz incele', 'interface review', 'branch/PR arayüz incelemesi'],
      },
      {
        name: 'state-machine',
        label: 'component state machine',
        example: '/state-machine',
        triggers: ['durum makinesi', 'state machine', 'state switcher', 'bilesen durumlari', 'bileşen durum makinesi'],
      },
      {
        name: 'break',
        label: 'stress test on a temporary page',
        example: '/break',
        triggers: ['gecici sayfada stres', 'stres testi sayfa', 'kirma senaryolari', 'geçici sayfada stres testi'],
      },
      {
        name: 'explain-interface',
        label: 'UI analysis from a URL or screenshot',
        example: '/explain-interface',
        triggers: ['arayuz analizi', 'nasil yapildigini acikla', 'explain interface', 'reverse engineer ui', 'URL/ekran görüntüsünden arayüz analizi'],
      },
      {
        name: 'pick-ui-library',
        label: 'choosing a UI library',
        example: '/pick-ui-library',
        triggers: ['arayuz kutuphanesi', 'ui kutuphanesi', 'kutuphane sec', 'ui library', 'pick-ui-library', 'arayüz kütüphanesi seçimi'],
      },
      {
        name: 'review-animations',
        label: 'animation craft review',
        example: '/review-animations',
        triggers: ['animasyon isciligi', 'animasyon incelemesi', 'review animations', 'animasyon işçiliği incelemesi'],
      },
    ],
  },
  {
    title: 'Manual-only — Software design (EGM)',
    when: 'Software idea brainstorming, formal design doc / spec drafting, independent multi-reviewer spec review, automated review loop, doc/code drift detection, review resolution, or directory README bootstrap',
    manual: true,
    skills: [
      {
        name: 'egm:egm-brainstorm',
        label: 'mature an idea',
        example: '/egm:egm-brainstorm',
        triggers: ['fikri olgunlastir', 'beyin firtinasi', 'brainstorm', 'mimari fikir', 'fikri olgunlaştır'],
      },
      {
        name: 'egm:egm-draft',
        label: 'formal spec / design doc draft',
        example: '/egm:egm-draft',
        triggers: ['formal spec', 'tasarim dokumani', 'design doc', 'teknik sartname', 'spec taslagi', 'spec yaz', 'formal spec / tasarım dokümanı taslağı'],
      },
      {
        name: 'egm:egm-review',
        label: 'design review with independent reviewers',
        example: '/egm:egm-review',
        triggers: ['bagimsiz hakem', 'tasarim inceleme', 'spec incele', 'design doc review', 'bağımsız hakemlerle tasarım inceleme'],
      },
      {
        name: 'egm:egm-review-loop',
        label: 'automated design review loop',
        example: '/egm:egm-review-loop',
        triggers: ['inceleme dongusu', 'review loop', 'otomatik inceleme dongusu', 'otomatik tasarım inceleme döngüsü'],
      },
      {
        name: 'egm:egm-drift-report',
        label: 'doc vs code drift report',
        example: '/egm:egm-drift-report',
        triggers: ['uyumsuzluk raporu', 'dokuman kod uyumsuz', 'drift report', 'doc code drift', 'doküman-kod uyumsuzluk raporu'],
      },
      {
        name: 'egm:egm-resolve',
        label: 'resolve review findings',
        example: '/egm:egm-resolve',
        triggers: ['bulgulari coz', 'inceleme bulgularini', 'resolve findings', 'inceleme bulgularını çöz'],
      },
      {
        name: 'egm:egm-bootstrap',
        label: 'README setup for directories',
        example: '/egm:egm-bootstrap',
        triggers: ['readme kurulumu', 'dizin readme', 'readme bootstrap', 'dizin README kurulumu'],
      },
    ],
  },
]
