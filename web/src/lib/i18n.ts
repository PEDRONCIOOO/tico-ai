export type Locale = 'pt-br' | 'en'

const dict: Record<string, Record<Locale, string>> = {
  // Upgrade page
  'upgrade.title': { 'pt-br': 'escolha seu plano', en: 'choose your plan' },
  'upgrade.subtitle': { 'pt-br': 'paga com pix ou cartão. cancela quando quiser.', en: 'pay with pix or card. cancel anytime.' },
  'upgrade.footer': { 'pt-br': 'assinatura mensal renovada automaticamente.', en: 'monthly subscription renewed automatically.' },
  'upgrade.back': { 'pt-br': 'voltar', en: 'back' },

  // Plan names
  'plan.free': { 'pt-br': 'grátis', en: 'free' },
  'plan.pro': { 'pt-br': 'pro', en: 'pro' },
  'plan.unlimited': { 'pt-br': 'ilimitado', en: 'unlimited' },

  // Plan periods
  'plan.forever': { 'pt-br': 'pra sempre', en: 'forever' },
  'plan.perMonth': { 'pt-br': '/mês', en: '/mo' },

  // Plan features
  'feat.10day': { 'pt-br': '10 usos por dia', en: '10 uses per day' },
  'feat.500month': { 'pt-br': '500 usos por mês', en: '500 uses per month' },
  'feat.unlimited': { 'pt-br': 'usos ilimitados', en: 'unlimited uses' },
  'feat.voice': { 'pt-br': 'voz natural em português', en: 'natural voice' },
  'feat.cursor': { 'pt-br': 'tico cursor inteligente', en: 'tico smart cursor' },
  'feat.cursorPointing': { 'pt-br': 'tico cursor + pointing', en: 'tico cursor + pointing' },
  'feat.sonnet': { 'pt-br': 'modelo claude sonnet', en: 'claude sonnet model' },
  'feat.opus': { 'pt-br': 'modelo claude opus', en: 'claude opus model' },
  'feat.priority': { 'pt-br': 'suporte prioritário', en: 'priority support' },
  'feat.earlyAccess': { 'pt-br': 'acesso antecipado a novidades', en: 'early access to new features' },

  // Buttons
  'btn.pix': { 'pt-br': 'pagar com pix', en: 'pay with pix' },
  'btn.card': { 'pt-br': 'pagar com cartão', en: 'pay with card' },
  'btn.currentPlan': { 'pt-br': 'plano atual', en: 'current plan' },
  'btn.defaultPlan': { 'pt-br': 'plano atual padrão', en: 'default plan' },
  'btn.redirecting': { 'pt-br': 'redirecionando...', en: 'redirecting...' },
  'btn.popular': { 'pt-br': 'popular', en: 'popular' },
  'btn.yourPlan': { 'pt-br': 'seu plano', en: 'your plan' },

  // Dashboard
  'dash.greeting': { 'pt-br': 'oi,', en: 'hi,' },
  'dash.subtitle': { 'pt-br': 'aqui voce gerencia sua conta do tico.', en: 'manage your tico account here.' },
  'dash.yourPlan': { 'pt-br': 'seu plano', en: 'your plan' },
  'dash.unlimitedUses': { 'pt-br': 'usos ilimitados', en: 'unlimited uses' },
  'dash.uses': { 'pt-br': 'usos', en: 'uses' },
  'dash.remaining': { 'pt-br': 'restantes', en: 'remaining' },
  'dash.resetsDaily': { 'pt-br': 'reseta em 24h', en: 'resets in 24h' },
  'dash.resetsMonthly': { 'pt-br': 'reseta todo mes', en: 'resets monthly' },
  'dash.upgrade': { 'pt-br': 'fazer upgrade', en: 'upgrade' },
  'dash.yourAccount': { 'pt-br': 'sua conta', en: 'your account' },
  'dash.email': { 'pt-br': 'email', en: 'email' },
  'dash.name': { 'pt-br': 'nome', en: 'name' },
  'dash.download': { 'pt-br': 'baixe o tico', en: 'download tico' },
  'dash.downloadDesc': { 'pt-br': 'instale no windows e faca login com essa mesma conta.', en: 'install on windows and log in with this account.' },
  'dash.downloadBtn': { 'pt-br': 'baixar para windows', en: 'download for windows' },
  'dash.nextPayment': { 'pt-br': 'próximo pagamento', en: 'next payment' },
  'dash.autoRenewal': { 'pt-br': 'renovação automática', en: 'auto renewal' },
  'dash.payments': { 'pt-br': 'pagamentos', en: 'payments' },
  'dash.noPayments': { 'pt-br': 'nenhum pagamento registrado', en: 'no payments recorded' },
  'dash.manageSubscription': { 'pt-br': 'gerenciar assinatura', en: 'manage subscription' },
  'dash.logout': { 'pt-br': 'sair', en: 'log out' },
  'dash.appToken': { 'pt-br': 'token do app', en: 'app token' },
  'dash.appTokenDesc': { 'pt-br': 'use esse token pra fazer login no app do tico no windows.', en: 'use this token to log in to the tico windows app.' },
  'dash.copy': { 'pt-br': 'copiar', en: 'copy' },
  'dash.copied': { 'pt-br': 'copiado!', en: 'copied!' },
  'dash.loading': { 'pt-br': 'carregando...', en: 'loading...' },
  'dash.feedback': { 'pt-br': 'feedback', en: 'feedback' },
  'dash.feedbackDesc': { 'pt-br': 'encontrou um bug ou tem uma ideia? manda pra gente.', en: 'found a bug or have an idea? let us know.' },
  'dash.feedbackPlaceholder': { 'pt-br': 'escreva aqui...', en: 'write here...' },
  'dash.feedbackSend': { 'pt-br': 'enviar', en: 'send' },
  'dash.feedbackSending': { 'pt-br': 'enviando...', en: 'sending...' },
  'dash.feedbackSent': { 'pt-br': 'mensagem enviada! obrigado pelo feedback.', en: 'message sent! thanks for the feedback.' },
  'dash.feedbackError': { 'pt-br': 'erro ao enviar, tente de novo', en: 'error sending, try again' },

  // Upgrade banner
  'banner.confirmed': { 'pt-br': 'pagamento confirmado!', en: 'payment confirmed!' },
  'banner.updating': { 'pt-br': 'seu plano será atualizado em alguns segundos.', en: 'your plan will be updated in a few seconds.' },

  // Tier names
  'tier.free': { 'pt-br': 'Gratis', en: 'Free' },
  'tier.pro': { 'pt-br': 'Pro', en: 'Pro' },
  'tier.unlimited': { 'pt-br': 'Ilimitado', en: 'Unlimited' },

  // Landing — nav
  'nav.features': { 'pt-br': 'recursos', en: 'features' },
  'nav.plans': { 'pt-br': 'planos', en: 'plans' },
  'nav.profile': { 'pt-br': 'perfil', en: 'profile' },
  'nav.login': { 'pt-br': 'entrar', en: 'log in' },
  'nav.download': { 'pt-br': 'baixar', en: 'download' },

  // Landing — hero
  'hero.badge': { 'pt-br': 'seu novo parceiro', en: 'your new buddy' },
  'hero.title1': { 'pt-br': 'seu amigo IA', en: 'your AI buddy' },
  'hero.title2': { 'pt-br': 'que te acompanha.', en: 'that guides you.' },
  'hero.desc': {
    'pt-br': 'o tico fica do lado do seu cursor, escuta suas perguntas, e te guia por qualquer coisa na tela. ele aponta pro lugar certo e fala em voz alta oque fazer. tipo um amigo que sabe de tudo.',
    en: 'tico stays next to your cursor, listens to your questions, and guides you through anything on screen. it points to the right spot and tells you what to do. like a friend who knows everything.',
  },
  'hero.downloadBtn': { 'pt-br': 'baixar para windows', en: 'download for windows' },
  'hero.seePlans': { 'pt-br': 'ver planos →', en: 'see plans →' },
  'hero.note': { 'pt-br': 'windows 10+ · grátis · 10 usos por dia', en: 'windows 10+ · free · 10 uses per day' },
  'hero.bubble': { 'pt-br': 'oi! eu sou o tico 👋', en: 'hi! i\'m tico 👋' },
  'hero.activeUsers': { 'pt-br': 'usuarios ativos', en: 'active users' },

  // Landing — features
  'features.title': { 'pt-br': 'pergunta qualquer coisa.', en: 'ask anything.' },
  'features.subtitle': { 'pt-br': 'o tico entende o que está na sua tela e responde em voz alta.', en: 'tico understands what\'s on your screen and answers out loud.' },
  'features.video.tag': { 'pt-br': 'vídeo', en: 'video' },
  'features.video.text': { 'pt-br': '"como faço color grading no davinci resolve?"', en: '"how do I color grade in davinci resolve?"' },
  'features.writing.tag': { 'pt-br': 'escrita', en: 'writing' },
  'features.writing.text': { 'pt-br': '"me ajuda a escrever o copy desse post de lançamento"', en: '"help me write the copy for this launch post"' },
  'features.learning.tag': { 'pt-br': 'aprendizado', en: 'learning' },
  'features.learning.text': { 'pt-br': '"o que esse painel do after effects faz?"', en: '"what does this after effects panel do?"' },
  'features.design.tag': { 'pt-br': 'design', en: 'design' },
  'features.design.text': { 'pt-br': '"como deixo esse design melhor?"', en: '"how can I make this design better?"' },
  'features.code.tag': { 'pt-br': 'código', en: 'code' },
  'features.code.text': { 'pt-br': '"me guia pra configurar esse projeto"', en: '"guide me to set up this project"' },
  'features.nav.tag': { 'pt-br': 'navegação', en: 'navigation' },
  'features.nav.text': { 'pt-br': '"aonde clico pra trocar pra dark mode?"', en: '"where do I click to switch to dark mode?"' },

  // Landing — how it works
  'how.title': { 'pt-br': 'como funciona', en: 'how it works' },
  'how.step1.title': { 'pt-br': 'aperte F8 e fale', en: 'press F8 and speak' },
  'how.step1.desc': { 'pt-br': 'segure a tecla, faça sua pergunta em voz alta, e solte. o tico escuta e vê sua tela.', en: 'hold the key, ask your question out loud, and release. tico listens and sees your screen.' },
  'how.step2.title': { 'pt-br': 'tico entende o contexto', en: 'tico understands the context' },
  'how.step2.desc': { 'pt-br': 'ele analisa o que está na tela, identifica os elementos, e monta uma resposta pra você.', en: 'it analyzes what\'s on screen, identifies the elements, and builds a response for you.' },
  'how.step3.title': { 'pt-br': 'ele te guia', en: 'it guides you' },
  'how.step3.desc': { 'pt-br': 'o tico fala a resposta e voa até o elemento certo na tela pra te mostrar onde clicar.', en: 'tico speaks the answer and flies to the right element on screen to show you where to click.' },

  // Landing — pricing
  'pricing.title': { 'pt-br': 'planos simples', en: 'simple plans' },
  'pricing.subtitle': { 'pt-br': 'comece de graça. escale quando fizer sentido.', en: 'start free. scale when it makes sense.' },
  'pricing.cta.free': { 'pt-br': 'baixar grátis', en: 'download free' },
  'pricing.cta.pro': { 'pt-br': 'assinar pro', en: 'subscribe pro' },
  'pricing.cta.unlimited': { 'pt-br': 'assinar ilimitado', en: 'subscribe unlimited' },

  // Landing — final CTA
  'cta.title': { 'pt-br': 'pronto pra ter seu amiguinho?', en: 'ready for your new buddy?' },
  'cta.desc': { 'pt-br': 'baixe o tico e comece a usar agora. grátis, sem cartão.', en: 'download tico and start using it now. free, no card needed.' },
  'cta.btn': { 'pt-br': 'baixar para windows', en: 'download for windows' },

  // Landing — footer
  'footer.credit': { 'pt-br': 'feito por', en: 'made by' },
  'footer.team': { 'pt-br': 'Equipe Tico', en: 'Tico Team' },
  'footer.tagline': { 'pt-br': 'pra quem quer aprender mais rápido', en: 'for those who want to learn faster' },
}

export function t(key: string, locale: Locale): string {
  return dict[key]?.[locale] ?? dict[key]?.['en'] ?? key
}

export function detectLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return 'en'
  const lower = acceptLanguage.toLowerCase()
  if (lower.startsWith('pt')) return 'pt-br'
  return 'en'
}

export function getLocaleFromCookie(cookieValue?: string | null): Locale | null {
  if (cookieValue === 'pt-br' || cookieValue === 'en') return cookieValue
  return null
}
