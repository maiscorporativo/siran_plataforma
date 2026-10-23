import { useState } from 'react'
import { Entrada, Selecao } from './ui'
import { mascaraCep, mascaraTelefone, soDigitos, UFS } from '../lib/format'

export type Dados = Record<string, string>

/* Converte um registro do banco em valores de formulário (strings já mascaradas) */
export function paraFormulario(a: Record<string, unknown>): Dados {
  const out: Dados = {}
  for (const [k, v] of Object.entries(a)) out[k] = v === null || v === undefined ? '' : String(v)
  if (out.telefone) out.telefone = mascaraTelefone(out.telefone)
  if (out.whatsapp) out.whatsapp = mascaraTelefone(out.whatsapp)
  if (out.cep) out.cep = mascaraCep(out.cep)
  if (out.propriedade_area_ha) out.propriedade_area_ha = out.propriedade_area_ha.replace('.', ',')
  return out
}

type Props = { dados: Dados; set: (campo: string, valor: string) => void }

export function CamposContato({ dados, set }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Entrada rotulo="WhatsApp" inputMode="tel" value={dados.whatsapp || ''} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} placeholder="(18) 99999-9999" />
      <Entrada rotulo="Telefone" inputMode="tel" value={dados.telefone || ''} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
      <Entrada rotulo="E-mail" type="email" className="sm:col-span-2" value={dados.email || ''} onChange={e => set('email', e.target.value)} />
    </div>
  )
}

export function CamposEndereco({ dados, set, cidadeObrigatoria }: Props & { cidadeObrigatoria?: boolean }) {
  const [buscando, setBuscando] = useState(false)

  async function buscarCep(cep: string) {
    const d = soDigitos(cep)
    if (d.length !== 8) return
    setBuscando(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (!j.erro) {
        if (j.logradouro) set('logradouro', j.logradouro)
        if (j.bairro) set('bairro', j.bairro)
        if (j.localidade) set('cidade', j.localidade)
        if (j.uf) set('uf', j.uf)
      }
    } catch { /* sem internet: preenchimento manual */ } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Entrada rotulo="CEP" className="sm:col-span-2" inputMode="numeric" value={dados.cep || ''}
        onChange={e => { const v = mascaraCep(e.target.value); set('cep', v); buscarCep(v) }}
        dica={buscando ? 'Buscando endereço…' : 'Preenche o endereço automaticamente'} />
      <Entrada rotulo="Endereço" className="sm:col-span-4" value={dados.logradouro || ''} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, estrada, rodovia…" />
      <Entrada rotulo="Número" className="sm:col-span-2" value={dados.numero || ''} onChange={e => set('numero', e.target.value)} />
      <Entrada rotulo="Complemento" className="sm:col-span-4" value={dados.complemento || ''} onChange={e => set('complemento', e.target.value)} placeholder="Km, sítio, lote…" />
      <Entrada rotulo="Bairro / localidade" className="sm:col-span-2" value={dados.bairro || ''} onChange={e => set('bairro', e.target.value)} />
      <Entrada rotulo="Cidade" className="sm:col-span-3" value={dados.cidade || ''} onChange={e => set('cidade', e.target.value)} required={cidadeObrigatoria} />
      <Selecao rotulo="UF" className="sm:col-span-1" value={dados.uf || 'SP'} onChange={e => set('uf', e.target.value)}>
        {UFS.map(u => <option key={u}>{u}</option>)}
      </Selecao>
    </div>
  )
}

export function CamposPropriedade({ dados, set }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Entrada rotulo="Nome da propriedade" value={dados.propriedade_nome || ''} onChange={e => set('propriedade_nome', e.target.value)} placeholder="Fazenda, sítio, estância…" />
      <Entrada rotulo="Município da propriedade" value={dados.propriedade_municipio || ''} onChange={e => set('propriedade_municipio', e.target.value)} />
      <Entrada rotulo="Área (hectares)" inputMode="decimal" value={dados.propriedade_area_ha || ''} onChange={e => set('propriedade_area_ha', e.target.value.replace(/[^\d,]/g, ''))} />
      <Entrada rotulo="Atividades principais" value={dados.atividades || ''} onChange={e => set('atividades', e.target.value)} placeholder="Ex.: pecuária de corte, cana, leite" />
      <Entrada rotulo="Inscrição de produtor rural" value={dados.inscricao_produtor || ''} onChange={e => set('inscricao_produtor', e.target.value)} />
      <Entrada rotulo="CCIR" value={dados.ccir || ''} onChange={e => set('ccir', e.target.value)} />
      <Entrada rotulo="CAR (Cadastro Ambiental Rural)" className="sm:col-span-2" value={dados.car || ''} onChange={e => set('car', e.target.value)} />
    </div>
  )
}

export const CAMPOS_EDITAVEIS = [
  'rg_ie', 'data_nascimento', 'email', 'telefone', 'whatsapp', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
  'propriedade_nome', 'propriedade_municipio', 'propriedade_area_ha', 'atividades', 'inscricao_produtor', 'car', 'ccir',
]

export function soEditaveis(d: Dados) {
  return Object.fromEntries(CAMPOS_EDITAVEIS.filter(c => c in d).map(c => [c, d[c]]))
}
