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
  'nav.updates': { 'pt-br': 'atualizacoes', en: 'updates' },
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
  'footer.terms': { 'pt-br': 'termos', en: 'terms' },
  'footer.privacy': { 'pt-br': 'privacidade', en: 'privacy' },

  // Updates page
  'updates.back': { 'pt-br': 'voltar', en: 'back' },
  'updates.title': { 'pt-br': 'atualizacoes', en: 'updates' },
  'updates.subtitle': { 'pt-br': 'novidades e mudancas no tico', en: 'news and changes in tico' },
  'updates.empty': { 'pt-br': 'nenhuma atualizacao ainda.', en: 'no updates yet.' },
  'updates.allUpdates': { 'pt-br': 'todas atualizacoes', en: 'all updates' },
  'updates.comments': { 'pt-br': 'comentarios', en: 'comments' },
  'updates.commentPlaceholder': { 'pt-br': 'escreva um comentario...', en: 'write a comment...' },
  'updates.send': { 'pt-br': 'enviar', en: 'send' },
  'updates.loginPrompt1': { 'pt-br': 'entre na sua conta', en: 'log in' },
  'updates.loginPrompt2': { 'pt-br': 'para curtir e comentar.', en: 'to like and comment.' },

  // Terms page
  'terms.back': { 'pt-br': 'voltar', en: 'back' },
  'terms.title': { 'pt-br': 'termos de uso', en: 'terms of use' },
  'terms.lastUpdated': { 'pt-br': 'ultima atualizacao: maio 2026', en: 'last updated: may 2026' },
  'terms.1.title': { 'pt-br': '1. aceitacao dos termos', en: '1. acceptance of terms' },
  'terms.1.text': { 'pt-br': 'ao usar o tico, voce concorda com estes termos. se nao concordar, nao use o servico. podemos atualizar estes termos a qualquer momento e o uso continuado significa que voce aceita as mudancas.', en: 'by using tico, you agree to these terms. if you do not agree, do not use the service. we may update these terms at any time and continued use means you accept the changes.' },
  'terms.2.title': { 'pt-br': '2. descricao do servico', en: '2. description of the service' },
  'terms.2.text': { 'pt-br': 'o tico e um assistente de inteligencia artificial para windows que vive na sua tela. ele escuta suas perguntas por voz, ve o que esta na sua tela via screenshot, e responde em voz alta apontando para elementos relevantes. o servico inclui o aplicativo desktop, o site (ticoai.app) e as apis associadas.', en: 'tico is an artificial intelligence assistant for windows that lives on your screen. it listens to your voice questions, sees what is on your screen via screenshot, and responds out loud pointing to relevant elements. the service includes the desktop app, the website (ticoai.app), and associated apis.' },
  'terms.3.title': { 'pt-br': '3. conta e registro', en: '3. account and registration' },
  'terms.3.text': { 'pt-br': 'para usar o tico, voce precisa criar uma conta com email e senha validos. voce e responsavel por manter a seguranca da sua conta e por todas as atividades realizadas nela. a senha minima e de 8 caracteres.', en: 'to use tico, you need to create an account with a valid email and password. you are responsible for maintaining the security of your account and for all activities performed on it. minimum password length is 8 characters.' },
  'terms.4.title': { 'pt-br': '4. planos e limites de uso', en: '4. plans and usage limits' },
  'terms.4.text': { 'pt-br': 'o tico oferece tres planos: gratis (10 usos por dia), pro (500 usos por mes) e ilimitado (sem limite). os limites sao contabilizados por chamada ao assistente. pagamentos sao processados via stripe (cartao internacional) ou abacatepay (pix). assinaturas sao renovadas automaticamente ate o cancelamento.', en: 'tico offers three plans: free (10 uses per day), pro (500 uses per month), and unlimited (no limit). limits are counted per assistant call. payments are processed via stripe (international card) or abacatepay (pix). subscriptions are renewed automatically until canceled.' },
  'terms.5.title': { 'pt-br': '5. uso permitido', en: '5. permitted use' },
  'terms.5.text': { 'pt-br': 'voce concorda em usar o tico apenas para fins legais e de acordo com estes termos. e proibido:', en: 'you agree to use tico only for legal purposes and in accordance with these terms. it is prohibited to:' },
  'terms.5.items': { 'pt-br': 'usar o servico para atividades ilegais ou prejudiciais|tentar fazer engenharia reversa, descompilar ou desmontar o software|criar contas falsas ou multiplas contas para burlar limites|sobrecarregar intencionalmente os servidores ou apis|revender ou redistribuir o acesso ao servico|usar o tico para gerar conteudo que viole direitos de terceiros', en: 'use the service for illegal or harmful activities|attempt to reverse engineer, decompile, or disassemble the software|create fake or multiple accounts to bypass limits|intentionally overload servers or apis|resell or redistribute access to the service|use tico to generate content that violates third-party rights' },
  'terms.6.title': { 'pt-br': '6. propriedade intelectual', en: '6. intellectual property' },
  'terms.6.text': { 'pt-br': 'o tico, incluindo o software, design, marca e conteudo do site, e propriedade da equipe tico. voce recebe uma licenca limitada, nao exclusiva e revogavel para uso pessoal do aplicativo.', en: 'tico, including the software, design, brand, and website content, is the property of the tico team. you receive a limited, non-exclusive, and revocable license for personal use of the application.' },
  'terms.7.title': { 'pt-br': '7. limitacao de responsabilidade', en: '7. limitation of liability' },
  'terms.7.text': { 'pt-br': 'o tico e fornecido "como esta". nao garantimos que as respostas da ia serao precisas, completas ou adequadas para qualquer finalidade especifica. nao somos responsaveis por decisoes tomadas com base nas respostas do assistente. em nenhum caso nossa responsabilidade total excedera o valor pago por voce nos ultimos 12 meses.', en: 'tico is provided "as is". we do not guarantee that ai responses will be accurate, complete, or suitable for any specific purpose. we are not responsible for decisions made based on assistant responses. in no event shall our total liability exceed the amount paid by you in the last 12 months.' },
  'terms.8.title': { 'pt-br': '8. cancelamento e encerramento', en: '8. cancellation and termination' },
  'terms.8.text': { 'pt-br': 'voce pode cancelar sua assinatura a qualquer momento pelo painel de gerenciamento (stripe) ou entrando em contato conosco. podemos suspender ou encerrar sua conta se voce violar estes termos, com ou sem aviso previo.', en: 'you can cancel your subscription at any time through the management panel (stripe) or by contacting us. we may suspend or terminate your account if you violate these terms, with or without prior notice.' },
  'terms.9.title': { 'pt-br': '9. alteracoes nos termos', en: '9. changes to terms' },
  'terms.9.text': { 'pt-br': 'podemos modificar estes termos a qualquer momento. mudancas significativas serao comunicadas por email ou pelo site. o uso continuado do servico apos alteracoes constitui aceitacao dos novos termos.', en: 'we may modify these terms at any time. significant changes will be communicated by email or on the website. continued use of the service after changes constitutes acceptance of the new terms.' },
  'terms.10.title': { 'pt-br': '10. contato', en: '10. contact' },
  'terms.10.text': { 'pt-br': 'duvidas sobre estes termos? entre em contato:', en: 'questions about these terms? contact us:' },

  // Privacy page
  'privacy.back': { 'pt-br': 'voltar', en: 'back' },
  'privacy.title': { 'pt-br': 'politica de privacidade', en: 'privacy policy' },
  'privacy.lastUpdated': { 'pt-br': 'ultima atualizacao: maio 2026', en: 'last updated: may 2026' },
  'privacy.1.title': { 'pt-br': '1. dados que coletamos', en: '1. data we collect' },
  'privacy.1.text': { 'pt-br': 'coletamos apenas o necessario para o funcionamento do servico:', en: 'we collect only what is necessary for the service to function:' },
  'privacy.1.items': { 'pt-br': 'conta: email, nome e senha (armazenada com hash seguro pelo supabase)|uso: contagem de chamadas ao assistente por periodo (para controle de plano)|pagamentos: historico de transacoes (valores, datas, metodo). dados de cartao sao processados diretamente pelo stripe e nunca passam pelos nossos servidores|feedback: mensagens enviadas voluntariamente pelo painel', en: 'account: email, name, and password (stored with secure hash by supabase)|usage: count of assistant calls per period (for plan control)|payments: transaction history (amounts, dates, method). card data is processed directly by stripe and never passes through our servers|feedback: messages sent voluntarily through the dashboard' },
  'privacy.2.title': { 'pt-br': '2. dados que NAO coletamos', en: '2. data we do NOT collect' },
  'privacy.2.text': { 'pt-br': 'o tico captura screenshots da sua tela apenas quando voce aperta a tecla de ativacao. essas imagens sao:', en: 'tico captures screenshots of your screen only when you press the activation key. these images are:' },
  'privacy.2.items': { 'pt-br': 'processadas em tempo real pela ia|descartadas imediatamente apos o processamento|nunca armazenadas nos nossos servidores|nunca compartilhadas com terceiros alem do processamento pela ia', en: 'processed in real-time by the ai|discarded immediately after processing|never stored on our servers|never shared with third parties beyond ai processing' },
  'privacy.2.extra': { 'pt-br': 'o mesmo vale para o audio capturado — e transcrito em tempo real e descartado.', en: 'the same applies to captured audio — it is transcribed in real-time and discarded.' },
  'privacy.3.title': { 'pt-br': '3. como usamos seus dados', en: '3. how we use your data' },
  'privacy.3.items': { 'pt-br': 'autenticar sua conta e manter sua sessao|controlar limites de uso do seu plano|processar pagamentos e gerenciar assinaturas|enviar comunicacoes sobre o servico (se necessario)|melhorar o produto com base em padroes de uso agregados', en: 'authenticate your account and maintain your session|control your plan usage limits|process payments and manage subscriptions|send service-related communications (if necessary)|improve the product based on aggregated usage patterns' },
  'privacy.4.title': { 'pt-br': '4. armazenamento e seguranca', en: '4. storage and security' },
  'privacy.4.text': { 'pt-br': 'seus dados sao armazenados no supabase (postgresql) com criptografia em repouso. tokens de autenticacao no aplicativo desktop sao protegidos com windows dpapi (criptografia por usuario). toda comunicacao e feita via https com tls 1.2+.', en: 'your data is stored on supabase (postgresql) with encryption at rest. authentication tokens in the desktop app are protected with windows dpapi (per-user encryption). all communication is done via https with tls 1.2+.' },
  'privacy.5.title': { 'pt-br': '5. servicos de terceiros', en: '5. third-party services' },
  'privacy.5.text': { 'pt-br': 'usamos os seguintes servicos para operar o tico:', en: 'we use the following services to operate tico:' },
  'privacy.5.items': { 'pt-br': 'anthropic (claude): processamento de ia para respostas e analise de tela|openai (whisper): transcricao de voz para texto|openai (tts): conversao de texto para voz|stripe: processamento de pagamentos com cartao (usd)|abacatepay: processamento de pagamentos pix (brl)|supabase: autenticacao e banco de dados|cloudflare: hospedagem de api e downloads|vercel: hospedagem do site', en: 'anthropic (claude): ai processing for responses and screen analysis|openai (whisper): voice-to-text transcription|openai (tts): text-to-speech conversion|stripe: card payment processing (usd)|abacatepay: pix payment processing (brl)|supabase: authentication and database|cloudflare: api and download hosting|vercel: website hosting' },
  'privacy.5.extra': { 'pt-br': 'cada servico tem sua propria politica de privacidade. recomendamos que voce as consulte.', en: 'each service has its own privacy policy. we recommend that you review them.' },
  'privacy.6.title': { 'pt-br': '6. cookies', en: '6. cookies' },
  'privacy.6.text': { 'pt-br': 'usamos cookies essenciais para autenticacao (sessao do supabase) e preferencia de idioma. nao usamos cookies de rastreamento, analytics ou publicidade.', en: 'we use essential cookies for authentication (supabase session) and language preference. we do not use tracking, analytics, or advertising cookies.' },
  'privacy.7.title': { 'pt-br': '7. seus direitos', en: '7. your rights' },
  'privacy.7.text': { 'pt-br': 'voce tem o direito de:', en: 'you have the right to:' },
  'privacy.7.items': { 'pt-br': 'acessar os dados que temos sobre voce|corrigir dados incorretos|solicitar a exclusao da sua conta e dados|exportar seus dados em formato legivel|cancelar sua assinatura a qualquer momento', en: 'access the data we have about you|correct inaccurate data|request deletion of your account and data|export your data in a readable format|cancel your subscription at any time' },
  'privacy.7.extra': { 'pt-br': 'para exercer esses direitos, entre em contato pelo email abaixo.', en: 'to exercise these rights, contact us at the email below.' },
  'privacy.8.title': { 'pt-br': '8. retencao de dados', en: '8. data retention' },
  'privacy.8.text': { 'pt-br': 'mantemos seus dados enquanto sua conta estiver ativa. apos exclusao da conta, dados pessoais sao removidos em ate 30 dias. dados de pagamento podem ser retidos por mais tempo conforme exigencias legais e fiscais.', en: 'we keep your data while your account is active. after account deletion, personal data is removed within 30 days. payment data may be retained longer as required by legal and tax obligations.' },
  'privacy.9.title': { 'pt-br': '9. menores de idade', en: '9. minors' },
  'privacy.9.text': { 'pt-br': 'o tico nao e destinado a menores de 13 anos. nao coletamos intencionalmente dados de criancas. se soubermos que uma crianca menor de 13 anos criou uma conta, a excluiremos.', en: 'tico is not intended for children under 13. we do not intentionally collect data from children. if we learn that a child under 13 has created an account, we will delete it.' },
  'privacy.10.title': { 'pt-br': '10. contato', en: '10. contact' },
  'privacy.10.text': { 'pt-br': 'duvidas sobre privacidade? entre em contato:', en: 'questions about privacy? contact us:' },

  // Trust badges
  'trust.poweredBy': { 'pt-br': 'powered by Claude', en: 'powered by Claude' },
  'trust.encrypted': { 'pt-br': 'criptografia 256-bit', en: '256-bit encrypted' },
  'trust.madeIn': { 'pt-br': 'feito no Brasil', en: 'made in Brazil' },

  // Testimonials
  'testimonials.title': { 'pt-br': 'quem usa, recomenda.', en: 'loved by users.' },
  'testimonials.1.quote': { 'pt-br': 'o tico me salvou horas tentando achar ferramentas no figma. agora eu so pergunto e ele aponta.', en: 'tico saved me hours trying to find tools in figma. now I just ask and it points.' },
  'testimonials.1.name': { 'pt-br': 'Ana S.', en: 'Ana S.' },
  'testimonials.1.role': { 'pt-br': 'designer', en: 'designer' },
  'testimonials.2.quote': { 'pt-br': 'uso o tico todo dia pra navegar no vscode e no terminal. e como pair programming com um amigo.', en: 'I use tico every day to navigate vscode and the terminal. it\'s like pair programming with a friend.' },
  'testimonials.2.name': { 'pt-br': 'Lucas M.', en: 'Lucas M.' },
  'testimonials.2.role': { 'pt-br': 'desenvolvedor', en: 'developer' },
  'testimonials.3.quote': { 'pt-br': 'estou aprendendo blender e o tico me guia passo a passo. melhor investimento que fiz.', en: 'I\'m learning blender and tico guides me step by step. best investment I\'ve made.' },
  'testimonials.3.name': { 'pt-br': 'Maria R.', en: 'Maria R.' },
  'testimonials.3.role': { 'pt-br': 'estudante', en: 'student' },

  // FAQ
  'faq.title': { 'pt-br': 'perguntas frequentes', en: 'frequently asked questions' },
  'faq.1.q': { 'pt-br': 'o tico e seguro?', en: 'is tico safe?' },
  'faq.1.a': { 'pt-br': 'sim. screenshots sao processados em tempo real e nunca armazenados. todos os dados sao criptografados e trafegam via https.', en: 'yes. screenshots are processed in real-time and never stored. all data is encrypted and transmitted via https.' },
  'faq.2.q': { 'pt-br': 'funciona sem internet?', en: 'does it work offline?' },
  'faq.2.a': { 'pt-br': 'nao, o tico precisa de internet para processamento de ia, reconhecimento de voz e sintese de fala.', en: 'no, tico needs internet for AI processing, voice recognition, and text-to-speech.' },
  'faq.3.q': { 'pt-br': 'como cancelo minha assinatura?', en: 'how do I cancel my subscription?' },
  'faq.3.a': { 'pt-br': 'pelo portal de gerenciamento do stripe no painel do tico, ou entre em contato pelo support@ticoai.app.', en: 'through the stripe management portal in the tico dashboard, or contact us at support@ticoai.app.' },
  'faq.4.q': { 'pt-br': 'quais apps o tico suporta?', en: 'which apps does tico support?' },
  'faq.4.a': { 'pt-br': 'qualquer app no windows. o tico ve sua tela e pode te ajudar com qualquer software.', en: 'any app on windows. tico sees your screen and can help you with any software.' },
  'faq.5.q': { 'pt-br': 'o tico grava minha tela?', en: 'does tico record my screen?' },
  'faq.5.a': { 'pt-br': 'nao. screenshots sao capturados apenas quando voce aperta a tecla, processados instantaneamente e descartados.', en: 'no. screenshots are captured only when you press the hotkey, processed instantly, and discarded.' },
  'faq.6.q': { 'pt-br': 'posso usar em portugues e ingles?', en: 'can I use it in Portuguese and English?' },
  'faq.6.a': { 'pt-br': 'sim, o tico detecta seu idioma automaticamente e responde na mesma lingua.', en: 'yes, tico detects your language automatically and responds in the same language.' },

  // Login page
  'login.title': { 'pt-br': 'entrar', en: 'log in' },
  'login.subtitle': { 'pt-br': 'acesse sua conta do tico', en: 'access your tico account' },
  'login.email': { 'pt-br': 'email', en: 'email' },
  'login.emailPlaceholder': { 'pt-br': 'seu@email.com', en: 'you@email.com' },
  'login.password': { 'pt-br': 'senha', en: 'password' },
  'login.submit': { 'pt-br': 'entrar', en: 'log in' },
  'login.submitting': { 'pt-br': 'entrando...', en: 'logging in...' },
  'login.invalidCredentials': { 'pt-br': 'email ou senha incorretos', en: 'invalid email or password' },
  'login.noAccount': { 'pt-br': 'não tem conta?', en: "don't have an account?" },
  'login.createAccount': { 'pt-br': 'criar conta', en: 'create account' },

  // Register page
  'register.title': { 'pt-br': 'criar conta', en: 'create account' },
  'register.subtitle': { 'pt-br': 'comece a usar o tico gratuitamente', en: 'start using tico for free' },
  'register.name': { 'pt-br': 'nome', en: 'name' },
  'register.namePlaceholder': { 'pt-br': 'seu nome', en: 'your name' },
  'register.email': { 'pt-br': 'email', en: 'email' },
  'register.emailPlaceholder': { 'pt-br': 'seu@email.com', en: 'you@email.com' },
  'register.password': { 'pt-br': 'senha', en: 'password' },
  'register.passwordPlaceholder': { 'pt-br': 'minimo 8 caracteres', en: 'min 8 characters' },
  'register.confirmPassword': { 'pt-br': 'confirmar senha', en: 'confirm password' },
  'register.confirmPlaceholder': { 'pt-br': 'repita a senha', en: 'repeat password' },
  'register.submit': { 'pt-br': 'criar conta gratis', en: 'create free account' },
  'register.submitting': { 'pt-br': 'criando...', en: 'creating...' },
  'register.hasAccount': { 'pt-br': 'ja tem conta?', en: 'already have an account?' },
  'register.login': { 'pt-br': 'entrar', en: 'log in' },
  'register.passwordMin': { 'pt-br': 'a senha precisa ter pelo menos 8 caracteres', en: 'password must be at least 8 characters' },
  'register.passwordMismatch': { 'pt-br': 'as senhas nao coincidem', en: 'passwords do not match' },

  // Verify email screen
  'verify.title': { 'pt-br': 'verifique seu e-mail', en: 'verify your email' },
  'verify.desc': { 'pt-br': 'voce precisa verificar seu e-mail para utilizar o tico.', en: 'you need to verify your email to use tico.' },
  'verify.sentTo': { 'pt-br': 'enviamos para:', en: 'we sent it to:' },
  'verify.resent': { 'pt-br': 'e-mail reenviado com sucesso', en: 'email resent successfully' },
  'verify.resending': { 'pt-br': 'reenviando...', en: 'resending...' },
  'verify.resendIn': { 'pt-br': 'reenviar e-mail em', en: 'resend email in' },
  'verify.resendBtn': { 'pt-br': 'reenviar e-mail de verificacao', en: 'resend verification email' },
  'verify.checkSpam': { 'pt-br': 'verifique tambem sua caixa de spam', en: 'also check your spam folder' },
  'verify.backToLogin': { 'pt-br': 'voltar para o login', en: 'back to login' },

  // Dashboard extras
  'dash.planUnlimited': { 'pt-br': 'Tico Ilimitado', en: 'Tico Unlimited' },
  'dash.planPro': { 'pt-br': 'Tico Pro', en: 'Tico Pro' },
  'dash.close': { 'pt-br': 'fechar', en: 'close' },
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
