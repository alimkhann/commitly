export type Language = 'en' | 'ru' | 'zh-TW' | 'kz'

export interface Translations {
  // Navbar
  support: string
  joinWaitlist: string

  // Hero section
  heroTitle: string
  heroSubtitle: string
  emailPlaceholder: string
  peopleJoined: string
  successMessage: string
  duplicateMessage: string
  errorMessage: string

  // Features section
  feature1Title: string
  feature1Subtitle: string
  feature2Title: string
  feature2Subtitle: string
  feature3Title: string
  feature3Subtitle: string

  // Bottom CTA
  joinWaitlistTitle: string

  // Modals
  joinWaitlistModalTitle: string
  modalEmailPlaceholder: string
  modalSuccessMessage: string
  modalDuplicateMessage: string
  modalErrorMessage: string

  // Footer
  copyright: string
  terms: string
  privacy: string

  // Button labels
  joinWaitlistButton: string
  joiningButton: string
  alreadyJoinedButton: string
  tryAgainButton: string
  sendButton: string
  sendingButton: string
  thanksButton: string

  // Common
  loading: string
  submit: string
}

export const translations: Record<Language, Translations> = {
  en: {
    // Navbar
    support: 'Support',
    joinWaitlist: 'Join waitlist',

    // Hero section
    // heroTitle: 'Do not copy/paste sh*tty code, create one',
    // heroTitle: 'Don\'t paste sh*tty code—write it.',
    heroTitle: 'Break down. Learn. Build.',
    heroSubtitle: 'Commitly turns a GitHub repo into a structured learning path, with hands-on tasks and tiny hints so you learn by building.',
    emailPlaceholder: 'Enter your email',
    peopleJoined: 'people already joined',
    successMessage: "You're in! 🚀",
    duplicateMessage: "You're already on the list.",
    errorMessage: 'Something went wrong. Please try again.',

    // Features section
    feature1Title: 'Commit History Roadmap',
    feature1Subtitle: "We turn noisy commit logs into a feature-by-feature storyline. Skim key diffs and milestones so you can follow how the project was actually built.",
    feature2Title: 'Hands-on tasks & tests',
    feature2Subtitle: 'Each chapter comes with bite - size tickets and failing tests. Ship the change, watch red turn green, and see your progress stack up like real SWE work.',
    feature3Title: 'Guiding hints',
    feature3Subtitle: "Start with questions and nudges - not answers. If you\’re stuck, reveal a tiny patch diff. No walls of code, so you keep ownership of the solution using the Socratic method.",

    // Bottom CTA
    joinWaitlistTitle: 'Join Waitlist',

    // Modals
    joinWaitlistModalTitle: 'Join the Waitlist',
    modalEmailPlaceholder: 'email@domain.com',
    modalSuccessMessage: 'You are on the list! 🚀',
    modalDuplicateMessage: "Looks like you're already signed up.",
    modalErrorMessage: 'Something went wrong. Please try again.',

    // Footer
    copyright: '© 2025 Commitly',
    terms: 'Terms',
    privacy: 'Privacy',

    // Button labels
    joinWaitlistButton: 'Join Waitlist',
    joiningButton: 'Joining…',
    alreadyJoinedButton: 'Already joined',
    tryAgainButton: 'Try again',
    sendButton: 'Send',
    sendingButton: 'Sending…',
    thanksButton: 'Thanks! We\'ll reply soon.',

    // Common
    loading: 'Loading...',
    submit: 'Submit'
  },
  ru: {
    // Navbar
    support: 'Поддержка',
    joinWaitlist: 'Войти в вейтлист',

    // Hero section
    heroTitle: 'Разбирай. Учись. Создавай.',
    heroSubtitle: 'Commitly превращает репозиторий GitHub в структурированный учебный курс с практическими заданиями и небольшими подсказками, чтобы вы учились, создавая.',
    emailPlaceholder: 'Введите свой email',
    peopleJoined: 'человек уже записались в очередь',
    successMessage: 'Вы в списке! 🚀',
    duplicateMessage: 'Вы уже в списке.',
    errorMessage: 'Что-то пошло не так. Пожалуйста, попробуйте еще раз.',

    // Features section
    feature1Title: 'Дорожная карта истории коммитов',
    feature1Subtitle: 'Мы превращаем шумные логи коммитов в сюжетную линию, описывающую каждую функцию. Просмотрите ключевые различия и ветки, чтобы понять, как на самом деле был построен проект.',
    feature2Title: 'Практические задачи и тесты',
    feature2Subtitle: 'Каждая глава сопровождается маленькими задачами. Стройте, наблюдайте, как красное становится зеленым, и следите за своим прогрессом, как в реальной работе разработчика.',
    feature3Title: 'Подсказки - путеводители',
    feature3Subtitle: 'Начните с вопросов и подсказок, а не с ответов. Если вы застряли, откройте небольшой патч-дифф. Никаких стен кода, так что вы сохраняете право собственности на решение, используя сократовский метод.',

    // Bottom CTA
    joinWaitlistTitle: 'Войти в вейтлист',

    // Modals
    joinWaitlistModalTitle: 'Войти в вейтлист',
    modalEmailPlaceholder: 'email@domain.com',
    modalSuccessMessage: 'Вы в списке! 🚀',
    modalDuplicateMessage: 'Похоже, вы уже зарегистрированы.',
    modalErrorMessage: 'Что-то пошло не так. Пожалуйста, попробуйте еще раз.',

    // Footer
    copyright: '© 2025 Commitly',
    terms: 'Условия',
    privacy: 'Конфиденциальность',

    // Button labels
    joinWaitlistButton: 'Войти в вейтлист',
    joiningButton: 'Вход…',
    alreadyJoinedButton: 'Уже вошли',
    tryAgainButton: 'Попробовать снова',
    sendButton: 'Отправить',
    sendingButton: 'Отправляем…',
    thanksButton: 'Спасибо! Мы скоро ответим.',

    // Common
    loading: 'Загрузка...',
    submit: 'Отправить'
  },
  'zh-TW': {
    // Navbar
    support: '支援',
    joinWaitlist: '加入等候名單',

    // Hero section
    heroTitle: '拆解.學習.建構.',
    heroSubtitle: 'Commitly 將 GitHub 儲存庫轉化為結構化的學習路徑，透過實作任務與精簡提示，讓您在建構中學習。',
    emailPlaceholder: '輸入你嘅電郵地址',
    peopleJoined: '人已加入',
    successMessage: '您已加入！🚀',
    duplicateMessage: '您已在名單中。',
    errorMessage: '出現錯誤。請重試。',

    // Features section
    feature1Title: '提交歷史路線圖',
    feature1Subtitle: '我們將雜亂的提交記錄轉化為功能導向的故事線。快速瀏覽關鍵差異與里程碑，親眼見證專案的實際建構歷程。',
    feature2Title: '實作任務與測試',
    feature2Subtitle: '每章節皆附精簡任務與失敗測試。提交變更、見證紅轉綠，親眼目睹進度累積如真實軟體工程師的工作成果。',
    feature3Title: '蘇格拉底式提示',
    feature3Subtitle: '從提問與提示開始，而非直接解答。若遇瓶頸，僅揭露微小補丁差異。無須面對整面程式碼牆，透過蘇格拉底式對話法，讓您全程主導解決方案。',

    // Bottom CTA
    joinWaitlistTitle: '加入等候名單',

    // Modals
    joinWaitlistModalTitle: '加入等候名單',
    modalEmailPlaceholder: 'email@domain.com',
    modalSuccessMessage: '您已在名單中！🚀',
    modalDuplicateMessage: '看起來您已經註冊了。',
    modalErrorMessage: '出現錯誤。請重試。',

    // Footer
    copyright: '© 2025 Commitly',
    terms: '條款',
    privacy: '隱私',

    // Button labels
    joinWaitlistButton: '加入等候名單',
    joiningButton: '加入中…',
    alreadyJoinedButton: '已加入',
    tryAgainButton: '重試',
    sendButton: '發送',
    sendingButton: '發送中…',
    thanksButton: '謝謝！我們會盡快回覆。',

    // Common
    loading: '載入中...',
    submit: '提交'
  },
  kz: {
    // Navbar
    support: 'Қолдау',
    joinWaitlist: 'Күту тізіміне қосылу',

    // Hero section
    heroTitle: 'Талда. Үйрен. Құр.',
    heroSubtitle: 'Commitly GitHub репозиторийін қолмен жұмыс істеу тапсырмалары мен кішкентай кеңестері бар құрылымдық оқу жолына айналдырады, сонда сіз құру арқылы үйренесіз.',
    emailPlaceholder: 'example@example.com',
    peopleJoined: 'адам қосылды',
    successMessage: 'Сіз тізімде! 🚀',
    duplicateMessage: 'Сіз қазірдің өзінде тізімдесіз.',
    errorMessage: 'Қате орын алды. Қайталап көріңіз.',

    // Features section
    feature1Title: 'Коммит тарихы жол картасы',
    feature1Subtitle: 'Біз шулы коммит журналдарын функциялар бойынша сюжеттік сызыққа айналдырамыз. Негізгі айырмашылықтар мен маңызды нүктелерді қарап шығыңыз, сонда жобаның қалай құрылғанын көре аласыз.',
    feature2Title: 'Қолмен жұмыс істеу тапсырмалары мен тесттер',
    feature2Subtitle: 'Әр тарау кішкентай тапсырмалар мен сәтсіз тесттермен бірге келеді. Өзгеріс жіберіңіз, қызылдың жасылға айналуын көріңіз және нақты бағдарламашы жұмысы сияқты прогрессіңіздің жиналуын бақылаңыз.',
    feature3Title: 'Басшылық кеңестер',
    feature3Subtitle: 'Жауаптардан емес, сұрақтар мен кеңестерден бастаңыз. Егер тұрып қалсаңыз, кішкентай патч айырмашылығын ашыңыз. Код қабырғалары жоқ, сонда сіз Сократ әдісін пайдаланып шешімнің иесі болып қаласыз.',

    // Bottom CTA
    joinWaitlistTitle: 'Күту тізіміне қосылу',

    // Modals
    joinWaitlistModalTitle: 'Күту тізіміне қосылу',
    modalEmailPlaceholder: 'Электрондық поштаңызды енгізіңіз',
    modalSuccessMessage: 'Сіз тізімде! 🚀',
    modalDuplicateMessage: 'Сіз қазірдің өзінде тіркелген сияқтысыз.',
    modalErrorMessage: 'Қате орын алды. Қайталап көріңіз.',

    // Footer
    copyright: '© 2025 Commitly',
    terms: 'Шарттар',
    privacy: 'Құпиялылық',

    // Button labels
    joinWaitlistButton: 'Күту тізіміне қосылу',
    joiningButton: 'Қосылуда…',
    alreadyJoinedButton: 'Қазірдің өзінде қосылды',
    tryAgainButton: 'Қайталап көр',
    sendButton: 'Жіберу',
    sendingButton: 'Жіберілуде…',
    thanksButton: 'Рахмет! Жауап береміз.',

    // Common
    loading: 'Жүктелуде...',
    submit: 'Жіберу'
  }
}

export const languageNames: Record<Language, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  kz: 'Қазақша',
  ru: 'Русский'
}
