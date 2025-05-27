import { Project } from '@/types';

export const projects: Project[] = [
  {
    id: 1,
    name: "Primus mall",
    description: {
      uz: "Primus Mall – bu oddiy onlayn do'kon emas, siz uyingizdan chiqmasdan onlayn xarid qilishingiz mumkin.",
      ru: "Primus Mall – это не просто онлайн-магазин с ограниченными возможностями, вы можете совершать покупки онлайн, не выходя из дома.",
    },
    technology: "React Native / Redux / Google Maps API / iOS / Android",
    location: "Uzbekistan",
    type: "Marketplace",
    playMarket: "https://play.google.com/store/apps/details?id=uz.pmall.app",
    appStore:
      "https://apps.apple.com/uz/app/primus-mall-marketplace/id1546081249",
    website: "",
  },
  {
    id: 2,
    name: "EDOCS",
    description: {
      uz: "E-DOCS (edocs.uz) yuridik ahamiyatga ega boʻlgan elektron hujjat aylanishini taʼminlash boʻyicha dasturiy taʼminot toʻplami elektron shaklda hisob-fakturalarni (yetkazib berish dalolatnomalari, dalolatnomalar va boshqalar) yaratish hamda ularni mijozlar va hamkorlar bilan almashish imkonini beruvchi tizimdir.",
      ru: "«E-DOCS» (edocs.uz) – это система, обеспечивающая цифровую обработку электронных документов, создание счетов-фактур (накладные, счета и прочие) в электронном формате и их обмен между клиентами и партнерами.",
    },
    technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
    location: "Uzbekistan",
    type: "Elektron Dokumentlar",
    playMarket: "https://play.google.com/store/apps/details?id=uz.edocs.app",
    appStore: "https://apps.apple.com/uz/app/edocs/id1525550801",
  },
  {
    id: 3,
    name: "BDM",
    description: {
      uz: "Biznes dasturlash markazi bo'lib, har bir hujjat BDM tizimi orqali imzolanib, qonuniy kuchga ega bo'ladi.",
      ru: "Бизнес-дастурлаш маркази, каждый документ подписывается через систему BDM и имеет юридическую силу.",
    },
    technology:
      "React Native / Redux Saga / Formik / Google Maps API / iOS / Android",
    location: "Uzbekistan",
    type: "BIZNES DASTURLASH MARKAZI",
    playMarket: "https://play.google.com/store/apps/details?id=uz.bdm.bdm_uz",
    appStore: "https://apps.apple.com/id/app/bdm-uz/id1641747341",
    website: "",
  },
  {
    id: 4,
    name: "ASCON",
    description: {
      uz: "ASCON loyihasi doirasida bizning xizmatimizdan foydalanib, sizga tezkor to'lov to'lanadi va zararni olish uchun boshqa holatlar bo'ylab yugurishingiz shart emas.",
      ru: "Пользуясь нашим сервисом в рамках проекта ASCON, вы будете быстро оплачены и не должны озабочиваться о возможных убытках.",
    },
    technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
    location: "Uzbekistan",
    type: "ASCON",
    playMarket:
      "https://play.google.com/store/apps/details?id=uz.sos.ascon&hl=ru",
    appStore: "https://apps.apple.com/ru/developer/ascon/id570657052",
  },
  {
    id: 5,
    name: "HeyAll",
    description: {
      uz: "HeyAll, ikki xil maqsadga xizmat qiluvchi va ularni uzluksiz bog'laydigan ilova. Bir tomondan, bu xostlar uchun o'z tadbirlarini rejalashtirish uchun ilova bo'lsa, boshqa tomondan, bu tadbirlarda ishlaydigan yetkazib beruvchilar uchun dastur.",
      ru: "HeyAll – приложение, которое обслуживает две разные цели и связывает их между собой. С одной стороны, это приложение для организации своих мероприятий для хостов, а с другой – это приложение для поставщиков, работающих на этих мероприятиях.",
    },
    technology:
      "React / React Native / Redux Thunks / Google Maps API / iOS / Android",
    location: "Europe",
    type: "HeyAll",
    playMarket: "https://play.google.com/store/apps/details?id=com.app.heyall",
    appStore: "https://apps.apple.com/au/app/heyall/id1590498767",
    website: "https://www.heyallapp.com/",
  },
  {
    id: 6,
    name: "Align 360",
    description: {
      uz: "Align 360 qurilish va ta'mirlash guruhlari uchun mo'ljallangan. Ilova vazifalar menejeri, tahliliy vosita va jamoalar ichida muloqot qilish uchun messenjerni birlashtiradi. Ilovadan ishni tashkil etuvchi pudratchilar ham, turli ixtisoslikdagi subpudratchilar ham foydalanishlari mumkin.",
      ru: "Align 360 разработан для строительных и ремонтных групп. Приложение объединяет менеджеров задач, аналитические инструменты и коммуникацию внутри групп. Используют его и мастера-монтажники, и подрядчики разных специализаций.",
    },
    technology:
      "React Native / Typescript / Redux Thunks / Google Maps API / iOS / Android",
    location: "All",
    type: "Align 360",
    playMarket: "https://play.google.com/store/apps/details?id=com.align360",
    appStore: "https://apps.apple.com/us/app/align-360/id1608045052",
  },
  {
    id: 7,
    name: "NAFT",
    description: {
      uz: "Agar sizga zudlik bilan ish kerak bo'lsa yoki aksincha, mutaxassis, u holda Naft aynan sizga kerak bo'lgan narsadir. Bizning ilovamiz tez va qulay nomzodlar va nomzodlarning cho'ntak manbai bo'lib, u erda har bir foydalanuvchi o'ziga kerakli narsani topa oladi.",
      ru: "Если вам нужна оперативная работа или, наоборот, специалист, тогда NAFT – именно то, что вам нужно. Наше приложение быстрое и удобное для соискателей и источников вакансий, где каждый пользователь может найти то, что ему нужно.",
    },
    technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
    location: "All",
    type: "NAFT",
    playMarket: "https://play.google.com/store/apps/details?id=itmaker.uz.naft",
    appStore: "https://apps.apple.com/us/app/naft/id1519755756",
  },
  {
    id: 8,
    name: "WorkAxle",
    description: {
      uz: "WorkAxle - bu kengaytiriladigan, kelajakka chidamli va tez miqyosda joylashtiriladigan zamonaviy va modulli korporativ ishchi kuchini boshqarish platformasi. Ushbu platforma an'anaviy monolit WFM ilovalari muammosini hal qiladi, shu bilan birga korporativ mijozlar uchun moslashtirilgan yechimni taqdim etadi.",
      ru: "WorkAxle - это расширяемая, гибкая и быстро развертываемая современная и модульная платформа управления корпоративными трудовыми мощностями. Эта платформа решает проблему традиционных монолитных WFM-приложений, предлагая адаптированные решения для корпоративных клиентов.",
    },
    technology: "React / Flexbox / Redux / Git ",
    location: "Canada",
    type: "WorkAxle",
    website: "https://www.workaxle.com/",
  },
  {
    id: 9,
    name: "Asia Insurance",
    description: {
      uz: "Asia Insurance mobil ilovasi bir necha daqiqada transport vositalari egalari uchun OSGO polisini, xorijga onlayn sayohat qilish uchun sug'urta polisini sotib olishga yordam beradi va bu hali boshlanishi!",
      ru: "Мобильное приложение Asia Insurance помогает владельцам транспортных средств за несколько минут приобрести ОСАГО, страховку для онлайн-путешествий за границу, и это только начало!",
    },
    technology:
      "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
    location: "Uzbekistan",
    type: "Asia Insurance",
    website: "https://asiainsurance.uz/",
  },
  {
    id: 10,
    name: "Nestegg.ai",
    description: {
      uz: "NestEgg sizga Buyuk Britaniyaning mas'ul kreditorlaridan ishonchli kreditlarni topishga, ariza topshirishga va ularni qabul qilishga yordam beradi. Platforma mas'ul kreditorlarga kredit arizalarini yuboradi va ular o'zlari va mijozlari uchun yaxshiroq kredit qarorlarini qabul qilishlari uchun kredit qarorlarini qabul qilish xizmatlarini taqdim etadi. U buni kredit, bank va boshqa ma'lumotlarni adolatli, moslashuvchan va shaffof tarzda tahlil qilish orqali amalga oshiradi.",
      ru: "NestEgg помогает находить надежные кредиты у британских ответственных кредиторов, подавать заявки и получать одобрение. Платформа отправляет кредитные заявки ответственным кредиторам, чтобы они могли принимать лучшие кредитные решения для себя и своих клиентов, а также анализирует кредит, банковские и другие данные честно, интегрированно и безопасно.",
    },
    technology:
      "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
    location: "Europe",
    type: "Nestegg.ai",
    website: "https://nestegg.ai/",
  },
  {
    id: 11,
    name: "Nestegg Loan",
    description: {
      uz: "NestEgg platformasi mas'ul kreditorlar tomonidan taqdim etilgan kredit mahsulotlari bilan qulay kredit izlayotganlarga mos keladi. Ariza beruvchilar to'g'ri kreditordan to'g'ri kreditni topadilar, ular qabul qilinadimi yoki yo'qmi va ariza berishadi. Agar yo'q bo'lsa, qanday qilib qabul qilinishi haqida maslahatlar oling.",
      ru: "Платформа NestEgg предлагает удобные кредитные продукты от ответственных кредиторов тем, кто ищет кредит. Заявители находят правильный кредит прямо от кредитора, они одобряются или нет, и предлагают консультации по тому, как быть, если не одобрены.",
    },
    technology:
      "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
    location: "Europe",
    type: "Nestegg.ai",
    website: "https://loans.nestegg.ai/",
  },
]; 