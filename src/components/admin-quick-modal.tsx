"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

export function AdminQuickModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir modal de edicao
      </Button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-50 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-[var(--wb-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
            >
              <h3 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
                Edicao rapida
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Exemplo visual de modal para ajuste de rodada.
              </p>
              <div className="mt-4 space-y-3">
                <Input placeholder="Nome da rodada" defaultValue="Rodada 3 - Grupos" />
                <Select defaultValue="group">
                  <option value="group">Fase de grupos</option>
                  <option value="round_of_16">Oitavas</option>
                  <option value="quarterfinal">Quartas</option>
                </Select>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="success" onClick={() => setOpen(false)}>
                  Salvar
                </Button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
