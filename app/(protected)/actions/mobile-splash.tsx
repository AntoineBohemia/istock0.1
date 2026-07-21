"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Ecran de lancement mobile.
 *
 * Les unites montent en cascade — le stock se remplit — puis la caisse tombe.
 * L'animation ne joue qu'au chargement de la page : les etapes suivantes sont
 * des couches posees par-dessus, elles ne remontent pas ce composant. La
 * rejouer a chaque retour a l'accueil ferait attendre un technicien qui
 * enchaine vingt mouvements.
 *
 * Les identifiants sont prefixes : inlines dans la page, ils partagent
 * l'espace de noms du document.
 */
const MARK_STYLE = `
  #istock-u1,#istock-u2,#istock-u3,#istock-dot {
    transform-box: fill-box;
    transform-origin: center;
  }
  #istock-u3 { animation: istock-rise .55s cubic-bezier(.2,.85,.25,1) .00s both; }
  #istock-u2 { animation: istock-rise .55s cubic-bezier(.2,.85,.25,1) .12s both; }
  #istock-u1 { animation: istock-rise .55s cubic-bezier(.2,.85,.25,1) .24s both; }
  #istock-dot { animation: istock-drop .60s cubic-bezier(.25,.9,.3,1.15) .42s both; }
  @keyframes istock-rise {
    from { transform: translateY(72px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes istock-drop {
    from { transform: translateY(-84px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    #istock-u1,#istock-u2,#istock-u3,#istock-dot {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
`;

/** Duree du lancement. La barre se remplit exactement sur ce temps. */
const HOLD_MS = 2000;

export function MobileSplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
          // Le lancement se retire par un fondu, sans glissement : rien ne
          // l'a pousse, il n'arrive de nulle part.
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          aria-hidden
        >
          <style dangerouslySetInnerHTML={{ __html: MARK_STYLE }} />

          <div className="flex flex-col items-center gap-10">
            {/* Taille relative a l'ecran : la marque doit dominer sur un petit
                telephone comme sur un grand, sans jamais toucher les bords. */}
            <svg
              viewBox="0 0 512 512"
              role="img"
              aria-label="iStock"
              className="w-[62vw] max-w-[300px]"
            >
              <rect
                id="istock-dot"
                x="196"
                y="112"
                width="120"
                height="104"
                rx="30"
                fill="#f59e0b"
              />
              <rect id="istock-u1" x="196" y="248" width="120" height="60" rx="28" fill="#4f46e5" />
              <rect id="istock-u2" x="196" y="322" width="120" height="60" rx="28" fill="#4f46e5" />
              <rect id="istock-u3" x="196" y="396" width="120" height="60" rx="28" fill="#4f46e5" />
            </svg>

            {/* Barre determinee : elle avance a vitesse constante et atteint le
                bout au moment ou l'ecran se retire. Une barre qui saute a 100%
                ou qui reste en chemin dit le contraire de ce qu'elle montre. */}
            <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full bg-foreground/60"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: HOLD_MS / 1000, ease: "linear" }}
                style={{ transformOrigin: "left" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
