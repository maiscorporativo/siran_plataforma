import { useParams } from 'react-router-dom'
import { BadgeCheck, ShieldAlert } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { data } from '../../lib/format'
import { Carregando } from '../../components/ui'

type Resultado = { nome: string; matricula: string | null; cidade: string | null; uf: string | null; validade_ate: string | null; situacao: string }

/* Página aberta pelo QR Code da carteirinha — usada por conveniados para conferir a filiação */
export default function Validar() {
  const { codigo } = useParams()
  const { dados, erro, carregando } = useApi<Resultado>(`/publico/validar/${codigo}`)
  const valido = dados && ['regular', 'renovar'].includes(dados.situacao)

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="bg-siran-950 px-6 py-5"><img src="/logo-siran-branco.png" alt="SIRAN" className="h-10" /></div>
        <div className="p-6 text-center">
          {carregando ? <Carregando texto="Conferindo carteirinha…" /> : erro || !dados ? (
            <>
              <ShieldAlert className="mx-auto size-14 text-red-600" />
              <p className="mt-3 text-lg font-semibold text-stone-900">Carteirinha não encontrada</p>
              <p className="mt-1 text-sm text-stone-500">O código não corresponde a nenhum associado do SIRAN.</p>
            </>
          ) : (
            <>
              {valido ? <BadgeCheck className="mx-auto size-14 text-siran-600" /> : <ShieldAlert className="mx-auto size-14 text-amber-600" />}
              <p className={`mt-3 text-lg font-semibold ${valido ? 'text-siran-900' : 'text-amber-800'}`}>
                {valido ? 'Associado em dia' : 'Filiação não regular'}
              </p>
              <dl className="mt-5 space-y-3 text-left text-sm">
                <div><dt className="text-stone-500">Nome</dt><dd className="font-medium text-stone-900">{dados.nome}</dd></div>
                <div className="flex gap-6">
                  <div><dt className="text-stone-500">Matrícula</dt><dd className="font-medium">{dados.matricula || '—'}</dd></div>
                  <div><dt className="text-stone-500">Válida até</dt><dd className="font-medium">{data(dados.validade_ate)}</dd></div>
                </div>
                {dados.cidade && <div><dt className="text-stone-500">Cidade</dt><dd className="font-medium">{dados.cidade}{dados.uf ? `/${dados.uf}` : ''}</dd></div>}
              </dl>
              <p className="mt-6 text-xs text-stone-400">Consulta feita em {new Date().toLocaleString('pt-BR')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
