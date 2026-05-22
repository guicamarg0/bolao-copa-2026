"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiSearch, FiXCircle } from "react-icons/fi";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-white">{title}</h2>
      <p className="text-sm text-slate-300">{description}</p>
    </div>
  );
}

export function UiKitShowcase() {
  const [openModal, setOpenModal] = useState(false);

  return (
    <section className="space-y-7">
      <Surface className="p-5">
        <SectionTitle
          title="Buttons"
          description="Primary, secondary, success, danger, ghost e ícone."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="icon" size="sm">
            <FiSearch />
          </Button>
        </div>
      </Surface>

      <Surface className="p-5">
        <SectionTitle
          title="Inputs e Selects"
          description="Estados normal, error, success, disabled e variantes de seleção."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Input normal" />
          <Input state="error" defaultValue="Input com erro" />
          <Input state="success" defaultValue="Input com sucesso" />
          <Input disabled defaultValue="Input desabilitado" />
          <Select defaultValue="standard">
            <option value="standard">Select standard</option>
          </Select>
          <Input placeholder="Searchable select (conceito)" />
          <Select multiple className="h-28">
            <option>Brasil</option>
            <option>Argentina</option>
            <option>França</option>
            <option>Alemanha</option>
          </Select>
          <Input placeholder="Tags / multi-select visual" />
        </div>
      </Surface>

      <Surface className="p-5">
        <SectionTitle
          title="Cards"
          description="Match cards, ranking cards, stats cards e profile cards."
        />
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <Badge tone="live">Live</Badge>
            <div className="mt-2 space-y-1">
              <TeamPill teamName="Brasil" />
              <p className="text-center font-display text-3xl text-white">1 × 0</p>
              <TeamPill teamName="Argentina" align="right" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-300">Ranking card</p>
            <p className="font-display text-5xl text-white">#1</p>
            <p className="text-sm font-semibold text-slate-100">Ana</p>
            <Badge tone="champion">126 pts</Badge>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-300">Statistic card</p>
            <p className="font-display text-5xl text-white">64</p>
            <p className="text-sm text-slate-200">Partidas da fase de grupos</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-300">Profile card</p>
            <p className="text-lg font-semibold text-slate-100">Bruno Lima</p>
            <p className="text-sm text-slate-300">@bruno</p>
            <Badge tone="admin">Admin</Badge>
          </div>
        </div>
      </Surface>

      <Surface className="p-5">
        <SectionTitle
          title="Tables"
          description="Tabela administrativa e tabela esportiva responsiva."
        />
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/10">
                  <td className="px-3 py-2">Ana</td>
                  <td className="px-3 py-2">Admin</td>
                  <td className="px-3 py-2">
                    <Badge tone="upcoming">Ativo</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost">
                      Editar
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-slate-100">Ana</p>
              <p className="text-xs text-slate-300">Admin • 126 pts</p>
            </div>
          </div>
        </div>
      </Surface>

      <Surface className="p-5">
        <SectionTitle
          title="Modais, Badges e Toasts"
          description="Confirmação, edição, detalhes de match, tags e feedbacks."
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpenModal(true)}>Abrir modal de confirmação</Button>
          <Badge tone="live">Live</Badge>
          <Badge tone="finished">Finished</Badge>
          <Badge tone="upcoming">Upcoming</Badge>
          <Badge tone="admin">Admin</Badge>
          <Badge tone="champion">Champion</Badge>
          <Badge tone="mvp">MVP</Badge>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
            <FiCheckCircle /> Palpite salvo com sucesso.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/45 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            <FiAlertCircle /> Faltam poucos minutos para o jogo iniciar.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-red-400/45 bg-red-500/15 px-3 py-2 text-sm text-red-100">
            <FiXCircle /> Não foi possível salvar.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-blue-300/45 bg-blue-500/15 px-3 py-2 text-sm text-blue-100">
            <FiInfo /> Rodada atualizada com novos jogos.
          </div>
        </div>
      </Surface>

      <Surface className="p-5">
        <SectionTitle
          title="Loading e Empty States"
          description="Skeletons/shimmer e estados vazios para jogos, palpites e ranking."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="h-3 w-24 animate-pulse rounded bg-white/12" />
            <div className="h-9 w-full animate-pulse rounded bg-white/10" />
            <div className="h-9 w-full animate-pulse rounded bg-white/10" />
          </div>
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-sm text-slate-300">
            Nenhum jogo encontrado nesta fase.
          </div>
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-sm text-slate-300">
            Você ainda não registrou palpites.
          </div>
        </div>
      </Surface>

      <AnimatePresence>
        {openModal ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-50 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenModal(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-[var(--wb-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
            >
              <h3 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
                Confirmar ação
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Este é um exemplo de modal para confirmar edição de placar.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenModal(false)}>
                  Cancelar
                </Button>
                <Button variant="success" onClick={() => setOpenModal(false)}>
                  Confirmar
                </Button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
