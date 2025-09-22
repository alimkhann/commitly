export type Language = 'en' | 'ru' | 'zh-TW'

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
    heroTitle: 'The AI Code Tutor',
    heroSubtitle: 'Paste a github repo link, and let AI guide you build the project you want.',
    emailPlaceholder: 'johndoe@example.com',
    peopleJoined: 'people already joined',
    successMessage: "You're in! 🚀",
    duplicateMessage: "You're already on the list.",
    errorMessage: 'Something went wrong. Please try again.',
    
    // Features section
    feature1Title: 'Commit History Roadmap',
    feature1Subtitle: "Turn any repo's commit history into clear chapters with the key diffs.",
    feature2Title: 'Hands-on tasks & tests',
    feature2Subtitle: 'Small, scoped tasks with failing tests — learn by making red turn green.',
    feature3Title: 'Socratic hints',
    feature3Subtitle: "Hints first. If you're stuck, reveal a tiny patch — not a wall of code.",
    
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
    heroTitle: 'ИИ-наставник по коду',
    heroSubtitle: 'Вставьте ссылку на GitHub репозиторий, и позвольте ИИ помочь вам создать проект, который вы хотите.',
    emailPlaceholder: 'ivan@example.com',
    peopleJoined: 'человек уже записались в очередь',
    successMessage: 'Вы в списке! 🚀',
    duplicateMessage: 'Вы уже в списке.',
    errorMessage: 'Что-то пошло не так. Пожалуйста, попробуйте еще раз.',
    
    // Features section
    feature1Title: 'Дорожная карта истории коммитов',
    feature1Subtitle: 'Превратите историю коммитов любого репозитория в понятные главы с ключевыми изменениями.',
    feature2Title: 'Практические задачи и тесты',
    feature2Subtitle: 'Небольшие, ограниченные задачи с падающими тестами — учитесь, делая красное зеленым.',
    feature3Title: 'Сократические подсказки',
    feature3Subtitle: 'Сначала подсказки. Если застряли, покажите крошечный патч — не стену кода.',
    
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
    heroTitle: 'AI 程式碼導師',
    heroSubtitle: '貼上 GitHub 儲存庫連結，讓 AI 引導您建立您想要的專案。',
    emailPlaceholder: 'example@example.com',
    peopleJoined: '人已加入',
    successMessage: '您已加入！🚀',
    duplicateMessage: '您已在名單中。',
    errorMessage: '出現錯誤。請重試。',
    
    // Features section
    feature1Title: '提交歷史路線圖',
    feature1Subtitle: '將任何儲存庫的提交歷史轉換為帶有關鍵差異的清晰章節。',
    feature2Title: '實作任務與測試',
    feature2Subtitle: '小型、範圍明確的任務與失敗的測試 — 透過讓紅色變綠色來學習。',
    feature3Title: '蘇格拉底式提示',
    feature3Subtitle: '先給提示。如果您卡住了，顯示一個小補丁 — 而不是一堵程式碼牆。',
    
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
  }
}

export const languageNames: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  'zh-TW': '繁體中文'
}
