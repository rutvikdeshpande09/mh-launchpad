// Small set of site labels, so the bilingual toggle translates the page chrome too.
export interface SiteStrings {
  about: string;
  offer: string;
  message: string;
  yourName: string;
  reach: string;
  send: string;
  sent: string;
  hours: string;
  area: string;
  card: string;
}

export const EN: SiteStrings = {
  about: "About us",
  offer: "What we offer",
  message: "Send us a message",
  yourName: "Your name",
  reach: "How can we reach you? (email or phone)",
  send: "Send message",
  sent: "Thank you! Your message was sent privately to the owner.",
  hours: "Hours",
  area: "Service area",
  card: "Our digital business card",
};

const STRINGS: Record<string, SiteStrings> = {
  en: EN,
  hi: {
    about: "हमारे बारे में",
    offer: "हम क्या देते हैं",
    message: "हमें संदेश भेजें",
    yourName: "आपका नाम",
    reach: "हम आपसे कैसे संपर्क करें? (ईमेल या फ़ोन)",
    send: "संदेश भेजें",
    sent: "धन्यवाद! आपका संदेश निजी तौर पर मालिक को भेज दिया गया है।",
    hours: "समय",
    area: "सेवा क्षेत्र",
    card: "हमारा डिजिटल बिज़नेस कार्ड",
  },
  es: {
    about: "Sobre nosotros",
    offer: "Lo que ofrecemos",
    message: "Envíanos un mensaje",
    yourName: "Tu nombre",
    reach: "¿Cómo podemos contactarte? (correo o teléfono)",
    send: "Enviar mensaje",
    sent: "¡Gracias! Tu mensaje se envió en privado al dueño.",
    hours: "Horario",
    area: "Zona de servicio",
    card: "Nuestra tarjeta de presentación digital",
  },
  te: {
    about: "మా గురించి",
    offer: "మేము అందించేవి",
    message: "మాకు సందేశం పంపండి",
    yourName: "మీ పేరు",
    reach: "మిమ్మల్ని ఎలా సంప్రదించాలి? (ఈమెయిల్ లేదా ఫోన్)",
    send: "సందేశం పంపండి",
    sent: "ధన్యవాదాలు! మీ సందేశం యజమానికి ప్రైవేట్‌గా పంపబడింది.",
    hours: "సమయాలు",
    area: "సేవా ప్రాంతం",
    card: "మా డిజిటల్ బిజినెస్ కార్డ్",
  },
  pa: {
    about: "ਸਾਡੇ ਬਾਰੇ",
    offer: "ਅਸੀਂ ਕੀ ਪੇਸ਼ ਕਰਦੇ ਹਾਂ",
    message: "ਸਾਨੂੰ ਸੁਨੇਹਾ ਭੇਜੋ",
    yourName: "ਤੁਹਾਡਾ ਨਾਮ",
    reach: "ਅਸੀਂ ਤੁਹਾਡੇ ਨਾਲ ਕਿਵੇਂ ਸੰਪਰਕ ਕਰੀਏ? (ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ)",
    send: "ਸੁਨੇਹਾ ਭੇਜੋ",
    sent: "ਧੰਨਵਾਦ! ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਨਿੱਜੀ ਤੌਰ 'ਤੇ ਮਾਲਕ ਨੂੰ ਭੇਜ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
    hours: "ਸਮਾਂ",
    area: "ਸੇਵਾ ਖੇਤਰ",
    card: "ਸਾਡਾ ਡਿਜੀਟਲ ਬਿਜ਼ਨਸ ਕਾਰਡ",
  },
  zh: {
    about: "关于我们",
    offer: "我们的产品与服务",
    message: "给我们留言",
    yourName: "您的姓名",
    reach: "我们如何联系您？（邮箱或电话）",
    send: "发送留言",
    sent: "谢谢！您的留言已私下发送给店主。",
    hours: "营业时间",
    area: "服务区域",
    card: "我们的电子名片",
  },
  tl: {
    about: "Tungkol sa Amin",
    offer: "Ano ang Alok Namin",
    message: "Magpadala ng Mensahe",
    yourName: "Pangalan mo",
    reach: "Paano ka namin makokontak? (email o telepono)",
    send: "Ipadala ang mensahe",
    sent: "Salamat! Pribadong naipadala ang mensahe mo sa may-ari.",
    hours: "Oras",
    area: "Lugar na sineserbisyuhan",
    card: "Ang aming digital business card",
  },
};

export const getStrings = (code: string): SiteStrings => STRINGS[code] ?? EN;
