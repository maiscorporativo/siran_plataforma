import express from 'express';
import crypto from 'crypto';
import pool, { transaction } from '../db.js';
import { associadoOpcional, requireAssociado, hojeISO, limiteLogin, registrarFalhaLogin } from '../lib/auth.js';
import { urlPublica } from '../lib/storage.js';
import { txt, soDigitos, cpfValido, like } from '../lib/util.js';
import { avisarInscricao } from '../lib/avisos.js';

const router = express.Router();

/* Vagas ocupadas e situação das inscrições de um curso */
export const CAMPOS_CURSO = `c.*,
  (SELECT COUNT(*) FROM inscricoes i WHERE i.curso_id = c.id AND i.status = 'confirmada') AS confirmadas,
  (SELECT COUNT(*) FROM inscricoes i WHERE i.curso_id = c.id AND i.status = 'espera') AS em_espera`;

export function situacaoCurso(c) {
  const hoje = hojeISO();
  const limite = c.inscricoes_ate || c.data_inicio;
  const encerrado = (c.data_fim || c.data_inicio) < hoje;
  const abertas = c.status === 'publicado' && !encerrado && limite >= hoje;
  const restantes = c.vagas === null ? null : Math.max(c.vagas - Number(c.confirmadas || 0), 0);
  return {
    ...c,
    imagem: urlPublica(c.imagem),
    vagas_restantes: restantes,
    inscricoes_abertas: abertas,
    lotado: restantes === 0,
    situacao: c.status === 'cancelado' ? 'cancelado' : encerrado ? 'encerrado' : c.data_inicio <= hoje ? 'em_andamento' : abertas ? 'aberto' : 'inscricoes_encerradas',
  };
}

/* Promove o primeiro da lista de espera quando abre vaga */
export async function promoverEspera(conn, cursoId) {
  const [[c]] = await conn.query(
    `SELECT vagas, (SELECT COUNT(*) FROM inscricoes WHERE curso_id = ? AND status = 'confirmada') AS confirmadas FROM cursos WHERE id = ?`,
    [cursoId, cursoId]);
  if (!c || (c.vagas !== null && c.confirmadas >= c.vagas)) return null;
  const [[prox]] = await conn.query(
    "SELECT id FROM inscricoes WHERE curso_id = ? AND status = 'espera' ORDER BY created_at, id LIMIT 1", [cursoId]);
  if (!prox) return null;
  await conn.query("UPDATE inscricoes SET status = 'confirmada' WHERE id = ?", [prox.id]);
  return prox.id;
}

/* Cria (ou reativa) uma inscrição respeitando as vagas — trava a linha do curso */
export async function inscrever(cursoId, dados) {
  return transaction(async conn => {
    const [[c]] = await conn.query(`SELECT ${CAMPOS_CURSO} FROM cursos c WHERE c.id = ? FOR UPDATE`, [cursoId]);
    if (!c) throw Object.assign(new Error('Curso não encontrado.'), { status: 404 });
    const s = situacaoCurso(c);
    if (!dados.forcar && !s.inscricoes_abertas) throw Object.assign(new Error('As inscrições deste curso estão encerradas.'), { status: 400 });
    if (!dados.forcar && c.publico === 'associados' && !dados.associado_id) {
      throw Object.assign(new Error('Este curso é exclusivo para associados do SIRAN. Entre na Área do Associado para se inscrever.'), { status: 403 });
    }
    const status = s.lotado ? 'espera' : 'confirmada';
    const [[existente]] = await conn.query('SELECT id, status, codigo FROM inscricoes WHERE curso_id = ? AND cpf = ?', [cursoId, dados.cpf]);
    if (existente && existente.status !== 'cancelada') {
      throw Object.assign(new Error(existente.status === 'espera' ? 'Este CPF já está na lista de espera deste curso.' : 'Este CPF já está inscrito neste curso.'), { status: 409, codigo: existente.codigo });
    }
    const campos = {
      associado_id: dados.associado_id || null, nome: dados.nome, telefone: dados.telefone, email: dados.email, cidade: dados.cidade,
      status, aceite_em: new Date(), presente: null,
    };
    if (existente) {
      await conn.query('UPDATE inscricoes SET ?, created_at = NOW() WHERE id = ?', [campos, existente.id]);
      return { id: existente.id, status, codigo: existente.codigo };
    }
    const codigo = crypto.randomBytes(16).toString('hex');
    const [r] = await conn.query('INSERT INTO inscricoes SET ?', [{ ...campos, curso_id: cursoId, cpf: dados.cpf, codigo }]);
    return { id: r.insertId, status, codigo };
  });
}

/* ── GET /api/cursos — agenda pública ── */
router.get('/', associadoOpcional, async (req, res) => {
  const q = req.query;
  const where = ["c.status IN ('publicado','cancelado')"];
  const params = [];
  if (q.anteriores === '1') where.push('COALESCE(c.data_fim, c.data_inicio) < CURDATE()');
  else where.push('COALESCE(c.data_fim, c.data_inicio) >= CURDATE()');
  if (['curso', 'evento'].includes(q.tipo)) { where.push('c.tipo = ?'); params.push(q.tipo); }
  if (q.cidade) { where.push('c.cidade = ?'); params.push(q.cidade); }
  if (q.categoria) { where.push('c.categoria = ?'); params.push(q.categoria); }
  if (q.q) { where.push('(c.titulo LIKE ? OR c.resumo LIKE ? OR c.categoria LIKE ?)'); params.push(like(q.q), like(q.q), like(q.q)); }
  const [rows] = await pool.query(
    `SELECT ${CAMPOS_CURSO} FROM cursos c WHERE ${where.join(' AND ')}
      ORDER BY ${q.anteriores === '1' ? 'c.data_inicio DESC' : 'c.data_inicio ASC'} LIMIT 200`, params);
  let minhas = {};
  if (req.associado) {
    const [ins] = await pool.query("SELECT curso_id, status FROM inscricoes WHERE cpf = ? AND status <> 'cancelada'", [req.associado.cpf_cnpj]);
    minhas = Object.fromEntries(ins.map(i => [i.curso_id, i.status]));
  }
  const [filtros] = await pool.query(
    "SELECT DISTINCT cidade, categoria FROM cursos WHERE status = 'publicado' AND COALESCE(data_fim, data_inicio) >= CURDATE()");
  res.json({
    itens: rows.map(c => ({ ...situacaoCurso(c), minha_inscricao: minhas[c.id] || null, descricao: undefined })),
    cidades: [...new Set(filtros.map(f => f.cidade).filter(Boolean))].sort(),
    categorias: [...new Set(filtros.map(f => f.categoria).filter(Boolean))].sort(),
  });
});

/* ── GET /api/cursos/minhas — inscrições do associado logado ── */
router.get('/minhas', requireAssociado, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT i.id, i.status, i.codigo, i.presente, i.created_at, c.id AS curso_id, c.titulo, c.tipo, c.data_inicio, c.data_fim,
            c.horario, c.cidade, c.local, c.status AS curso_status, c.carga_horaria
       FROM inscricoes i JOIN cursos c ON c.id = i.curso_id
      WHERE (i.associado_id = ? OR i.cpf = ?) AND i.status <> 'cancelada'
      ORDER BY c.data_inicio DESC`, [req.associado.id, req.associado.cpf_cnpj]);
  res.json(rows);
});

router.get('/:id', associadoOpcional, async (req, res) => {
  const [[c]] = await pool.query(`SELECT ${CAMPOS_CURSO} FROM cursos c WHERE c.id = ? AND c.status <> 'rascunho'`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Curso não encontrado.' });
  let minha = null;
  if (req.associado) {
    const [[i]] = await pool.query("SELECT status, codigo FROM inscricoes WHERE curso_id = ? AND cpf = ? AND status <> 'cancelada'", [c.id, req.associado.cpf_cnpj]);
    minha = i || null;
  }
  res.json({ ...situacaoCurso(c), minha_inscricao: minha, associado_logado: !!req.associado });
});

/* ── POST /api/cursos/:id/inscricao ──
   Associado logado: usa os dados do cadastro. Público: nome, CPF, telefone, e-mail, cidade. */
router.post('/:id/inscricao', associadoOpcional, async (req, res) => {
  const chave = `insc:${req.ip}`;
  // Limite folgado: no sindicato, uma mesma rede pode inscrever várias pessoas seguidas
  if (!limiteLogin(chave, 40)) return res.status(429).json({ error: 'Muitas inscrições seguidas. Aguarde alguns minutos.' });
  let dados;
  const a = req.associado;
  if (a && a.status === 'ativo') {
    dados = { associado_id: a.id, nome: a.nome, cpf: a.cpf_cnpj.slice(0, 11), telefone: a.whatsapp || a.telefone, email: a.email, cidade: a.cidade };
    if (a.tipo_pessoa === 'PJ') {
      // Empresa associada: inscreve a pessoa indicada (precisa de CPF próprio)
      const cpf = soDigitos(req.body.cpf);
      if (!cpfValido(cpf) || !txt(req.body.nome)) return res.status(400).json({ error: 'Informe nome e CPF de quem vai participar.' });
      dados = { ...dados, nome: txt(req.body.nome, 160), cpf };
    }
  } else {
    registrarFalhaLogin(chave);
    const b = req.body;
    dados = {
      nome: txt(b.nome, 160), cpf: soDigitos(b.cpf), telefone: soDigitos(b.telefone) || null,
      email: txt(b.email, 160)?.toLowerCase() || null, cidade: txt(b.cidade, 80),
    };
    if (!dados.nome || dados.nome.split(/\s+/).length < 2) return res.status(400).json({ error: 'Informe o nome completo.' });
    if (!cpfValido(dados.cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    if (!dados.telefone && !dados.email) return res.status(400).json({ error: 'Informe um WhatsApp ou e-mail para receber a confirmação.' });
    if (b.aceite !== true && b.aceite !== 'true') return res.status(400).json({ error: 'É preciso concordar com o uso dos dados para a inscrição.' });
    // CPF de associado ativo inscreve vinculado ao cadastro
    const [[assoc]] = await pool.query("SELECT id FROM associados WHERE cpf_cnpj = ? AND status = 'ativo'", [dados.cpf]);
    if (assoc) dados.associado_id = assoc.id;
  }
  try {
    const r = await inscrever(Number(req.params.id), dados);
    avisarInscricao(r.id, r.status === 'espera' ? 'espera' : 'confirmada');
    res.status(201).json({ status: r.status, codigo: r.codigo });
  } catch (err) {
    if (err.codigo) return res.status(409).json({ error: err.message, codigo: err.codigo });
    throw err;
  }
});

/* ── Consulta e cancelamento pelo link recebido (sem login) ── */
router.get('/inscricao/:codigo', async (req, res) => {
  const [[i]] = await pool.query(
    `SELECT i.nome, i.status, i.created_at, c.id AS curso_id, c.titulo, c.tipo, c.data_inicio, c.data_fim, c.horario, c.local,
            c.cidade, c.status AS curso_status,
            (SELECT COUNT(*) + 1 FROM inscricoes e WHERE e.curso_id = i.curso_id AND e.status = 'espera' AND (e.created_at < i.created_at OR (e.created_at = i.created_at AND e.id < i.id))) AS posicao_espera
       FROM inscricoes i JOIN cursos c ON c.id = i.curso_id WHERE i.codigo = ?`, [String(req.params.codigo).slice(0, 32)]);
  if (!i) return res.status(404).json({ error: 'Inscrição não encontrada.' });
  res.json({ ...i, posicao_espera: i.status === 'espera' ? i.posicao_espera : null });
});

router.post('/inscricao/:codigo/cancelar', async (req, res) => {
  const [[i]] = await pool.query('SELECT id, curso_id, status FROM inscricoes WHERE codigo = ?', [String(req.params.codigo).slice(0, 32)]);
  if (!i) return res.status(404).json({ error: 'Inscrição não encontrada.' });
  if (i.status === 'cancelada') return res.json({ ok: true });
  const promovido = await transaction(async conn => {
    await conn.query('SELECT id FROM cursos WHERE id = ? FOR UPDATE', [i.curso_id]);
    await conn.query("UPDATE inscricoes SET status = 'cancelada' WHERE id = ?", [i.id]);
    return i.status === 'confirmada' ? promoverEspera(conn, i.curso_id) : null;
  });
  if (promovido) avisarInscricao(promovido, 'promovida');
  res.json({ ok: true });
});

export default router;
