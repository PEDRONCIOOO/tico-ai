export default function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>termos de uso</h1>
        <p className="text-sm text-[#8A8A8A] mb-10">ultima atualizacao: maio 2026</p>

        <div className="space-y-8 text-[15px] text-[#4A4A4A] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">1. aceitacao dos termos</h2>
            <p>ao usar o tico, voce concorda com estes termos. se nao concordar, nao use o servico. podemos atualizar estes termos a qualquer momento e o uso continuado significa que voce aceita as mudancas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">2. descricao do servico</h2>
            <p>o tico e um assistente de inteligencia artificial para windows que vive na sua tela. ele escuta suas perguntas por voz, ve o que esta na sua tela via screenshot, e responde em voz alta apontando para elementos relevantes. o servico inclui o aplicativo desktop, o site (ticoai.app) e as apis associadas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">3. conta e registro</h2>
            <p>para usar o tico, voce precisa criar uma conta com email e senha validos. voce e responsavel por manter a seguranca da sua conta e por todas as atividades realizadas nela. a senha minima e de 8 caracteres.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">4. planos e limites de uso</h2>
            <p>o tico oferece tres planos: gratis (10 usos por dia), pro (500 usos por mes) e ilimitado (sem limite). os limites sao contabilizados por chamada ao assistente. pagamentos sao processados via stripe (cartao internacional) ou abacatepay (pix). assinaturas sao renovadas automaticamente ate o cancelamento.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">5. uso permitido</h2>
            <p>voce concorda em usar o tico apenas para fins legais e de acordo com estes termos. e proibido:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>usar o servico para atividades ilegais ou prejudiciais</li>
              <li>tentar fazer engenharia reversa, descompilar ou desmontar o software</li>
              <li>criar contas falsas ou multiplas contas para burlar limites</li>
              <li>sobrecarregar intencionalmente os servidores ou apis</li>
              <li>revender ou redistribuir o acesso ao servico</li>
              <li>usar o tico para gerar conteudo que viole direitos de terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">6. propriedade intelectual</h2>
            <p>o tico, incluindo o software, design, marca e conteudo do site, e propriedade da equipe tico. voce recebe uma licenca limitada, nao exclusiva e revogavel para uso pessoal do aplicativo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">7. limitacao de responsabilidade</h2>
            <p>o tico e fornecido "como esta". nao garantimos que as respostas da ia serao precisas, completas ou adequadas para qualquer finalidade especifica. nao somos responsaveis por decisoes tomadas com base nas respostas do assistente. em nenhum caso nossa responsabilidade total excedera o valor pago por voce nos ultimos 12 meses.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">8. cancelamento e encerramento</h2>
            <p>voce pode cancelar sua assinatura a qualquer momento pelo painel de gerenciamento (stripe) ou entrando em contato conosco. podemos suspender ou encerrar sua conta se voce violar estes termos, com ou sem aviso previo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">9. alteracoes nos termos</h2>
            <p>podemos modificar estes termos a qualquer momento. mudancas significativas serao comunicadas por email ou pelo site. o uso continuado do servico apos alteracoes constitui aceitacao dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">10. contato</h2>
            <p>duvidas sobre estes termos? entre em contato: <a href="mailto:support@ticoai.app" className="text-[#7C3AED] hover:underline">support@ticoai.app</a></p>
          </section>
        </div>
      </main>
    </div>
  )
}
