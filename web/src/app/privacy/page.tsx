export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <nav className="border-b border-black/[0.04] bg-white/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
          </a>
          <a href="/" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">voltar</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>politica de privacidade</h1>
        <p className="text-sm text-[#8A8A8A] mb-10">ultima atualizacao: maio 2026</p>

        <div className="space-y-8 text-[15px] text-[#4A4A4A] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">1. dados que coletamos</h2>
            <p>coletamos apenas o necessario para o funcionamento do servico:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>conta:</strong> email, nome e senha (armazenada com hash seguro pelo supabase)</li>
              <li><strong>uso:</strong> contagem de chamadas ao assistente por periodo (para controle de plano)</li>
              <li><strong>pagamentos:</strong> historico de transacoes (valores, datas, metodo). dados de cartao sao processados diretamente pelo stripe e nunca passam pelos nossos servidores</li>
              <li><strong>feedback:</strong> mensagens enviadas voluntariamente pelo painel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">2. dados que NAO coletamos</h2>
            <p>o tico captura screenshots da sua tela apenas quando voce aperta a tecla de ativacao. essas imagens sao:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>processadas em tempo real pela ia</li>
              <li>descartadas imediatamente apos o processamento</li>
              <li>nunca armazenadas nos nossos servidores</li>
              <li>nunca compartilhadas com terceiros alem do processamento pela ia</li>
            </ul>
            <p className="mt-2">o mesmo vale para o audio capturado — e transcrito em tempo real e descartado.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">3. como usamos seus dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>autenticar sua conta e manter sua sessao</li>
              <li>controlar limites de uso do seu plano</li>
              <li>processar pagamentos e gerenciar assinaturas</li>
              <li>enviar comunicacoes sobre o servico (se necessario)</li>
              <li>melhorar o produto com base em padroes de uso agregados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">4. armazenamento e seguranca</h2>
            <p>seus dados sao armazenados no supabase (postgresql) com criptografia em repouso. tokens de autenticacao no aplicativo desktop sao protegidos com windows dpapi (criptografia por usuario). toda comunicacao e feita via https com tls 1.2+.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">5. servicos de terceiros</h2>
            <p>usamos os seguintes servicos para operar o tico:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>anthropic (claude):</strong> processamento de ia para respostas e analise de tela</li>
              <li><strong>openai (whisper):</strong> transcricao de voz para texto</li>
              <li><strong>openai (tts):</strong> conversao de texto para voz</li>
              <li><strong>stripe:</strong> processamento de pagamentos com cartao (usd)</li>
              <li><strong>abacatepay:</strong> processamento de pagamentos pix (brl)</li>
              <li><strong>supabase:</strong> autenticacao e banco de dados</li>
              <li><strong>cloudflare:</strong> hospedagem de api e downloads</li>
              <li><strong>vercel:</strong> hospedagem do site</li>
            </ul>
            <p className="mt-2">cada servico tem sua propria politica de privacidade. recomendamos que voce as consulte.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">6. cookies</h2>
            <p>usamos cookies essenciais para autenticacao (sessao do supabase) e preferencia de idioma. nao usamos cookies de rastreamento, analytics ou publicidade.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">7. seus direitos</h2>
            <p>voce tem o direito de:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>acessar os dados que temos sobre voce</li>
              <li>corrigir dados incorretos</li>
              <li>solicitar a exclusao da sua conta e dados</li>
              <li>exportar seus dados em formato legivel</li>
              <li>cancelar sua assinatura a qualquer momento</li>
            </ul>
            <p className="mt-2">para exercer esses direitos, entre em contato pelo email abaixo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">8. retencao de dados</h2>
            <p>mantemos seus dados enquanto sua conta estiver ativa. apos exclusao da conta, dados pessoais sao removidos em ate 30 dias. dados de pagamento podem ser retidos por mais tempo conforme exigencias legais e fiscais.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">9. menores de idade</h2>
            <p>o tico nao e destinado a menores de 13 anos. nao coletamos intencionalmente dados de criancas. se soubermos que uma crianca menor de 13 anos criou uma conta, a excluiremos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">10. contato</h2>
            <p>duvidas sobre privacidade? entre em contato: <a href="mailto:support@ticoai.app" className="text-[#7C3AED] hover:underline">support@ticoai.app</a></p>
          </section>
        </div>
      </main>
    </div>
  )
}
