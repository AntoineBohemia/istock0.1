"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ou s'arrete un geste lance, d'apres sa vitesse au relachement.
 *
 * On ne decide pas au point ou le doigt quitte l'ecran mais la ou l'elan
 * l'emmenait : un petit mouvement rapide doit suffire a fermer. C'est la
 * fonction de projection d'Apple, la meme que la deceleration du defilement.
 */
function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Ecran pousse, facon navigation iOS.
 *
 * Les etapes arrivaient jusqu'ici dans un tiroir qui monte du bas. Sur iOS un
 * tiroir signale une tache modale que l'on peut abandonner ; un enchainement
 * d'etapes se presente au contraire comme une pile d'ecrans qui glissent
 * lateralement, avec une barre de navigation et un retour a gauche. Le geste
 * et le sens doivent concorder, sinon le retour arriere semble annuler.
 *
 * Le mouvement passe par un ressort et non par une animation CSS : une
 * keyframe ne peut pas etre saisie ni inversee en vol. On pouvait lancer le
 * retour sans pouvoir se raviser, et le glissement au doigt etait impossible
 * puisque rien ne suivait le pointeur.
 */
export function MobileStackScreen({
  open,
  title,
  subtitle,
  onBack,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  /** Ligne secondaire sous le titre — destination, technicien, etc. */
  subtitle?: string;
  /** Absent = pas de retour possible, on est a la racine de la pile */
  onBack?: () => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Barre d'action collee en bas, au-dessus de la zone sure */
  footer?: React.ReactNode;
}) {
  // Mouvement reduit : on remplace le glissement par un fondu, sans supprimer
  // le retour visuel — l'ecran doit toujours signaler qu'il a change.
  const reduceMotion = useReducedMotion();

  // Le corps ne doit pas defiler derriere l'ecran pousse
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Ressort critique : rejoint la cible sans rebond. Le depassement n'a de
  // sens que si le geste portait un elan, ce qui n'est pas le cas d'un appui
  // sur un bouton.
  const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // On juge sur la projection de l'elan, pas sur la distance parcourue :
    // un geste bref et vif doit fermer aussi bien qu'un long glissement.
    const projected = info.offset.x + project(info.velocity.x);
    if (projected > window.innerWidth * 0.35) {
      navigator.vibrate?.(10);
      if (onBack) onBack();
      else onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-background will-change-transform"
          role="dialog"
          aria-label={title}
          initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={spring}
          // Glissement de retour : l'ecran suit le doigt vers la droite, le
          // sens par lequel il est arrive. Vers la gauche il ne bouge pas,
          // il n'y a rien au-dela.
          drag={reduceMotion ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 1 }}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          {/* ── Barre de navigation ── */}
          <div className="shrink-0 border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="relative flex items-center justify-center h-11 px-2">
              {onBack ? (
                <button
                  onClick={onBack}
                  className="absolute left-0 flex items-center gap-0.5 h-11 pl-1 pr-3 text-primary active:opacity-50 transition-opacity"
                >
                  <ChevronLeft className="size-6 -mr-1" />
                  <span className="text-[17px]">Retour</span>
                </button>
              ) : null}

              <div className="max-w-[55%] text-center">
                <p className="font-semibold text-[17px] leading-tight truncate">{title}</p>
                {subtitle && (
                  <p className="text-[12px] text-muted-foreground leading-tight truncate">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="absolute right-0 h-11 px-3 text-[17px] text-primary active:opacity-50 transition-opacity"
              >
                OK
              </button>
            </div>
          </div>

          {/* ── Contenu ── */}
          {/* Le defilement est laisse a l'ecran appele : certaines etapes ont un
          en-tete fixe (recherche) au-dessus d'une zone qui defile seule. */}
          <div className="flex-1 min-h-0 flex flex-col overscroll-contain">{children}</div>

          {/* ── Barre d'action ── */}
          {footer && (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Liste groupee encadree, facon Reglages iOS.
 *
 * Le titre de section est en petites capitales au-dessus du groupe, jamais
 * dans le cadre : c'est ce qui distingue un intitule d'une ligne cliquable.
 */
export function InsetGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {header && (
        <p className="px-1 text-[13px] uppercase tracking-wide text-muted-foreground">{header}</p>
      )}
      <div className="overflow-hidden rounded-xl border bg-white dark:bg-card">{children}</div>
      {footer && <p className="px-1 text-[13px] text-muted-foreground">{footer}</p>}
    </div>
  );
}

/**
 * Ligne d'une liste groupee.
 *
 * Le separateur est aligne sur le texte et non sur le bord : sur iOS il part
 * apres l'icone, ce qui rattache visuellement chaque ligne a son symbole.
 */
export function InsetRow({
  leading,
  title,
  subtitle,
  trailing,
  chevron = true,
  onClick,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-left active:bg-muted/60 transition-colors [&+&]:border-t [&+&]:border-border/60"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] leading-tight truncate">{title}</span>
        {subtitle && (
          <span className="block text-[13px] text-muted-foreground leading-tight truncate">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
      {chevron && <ChevronLeft className="size-4 shrink-0 rotate-180 text-muted-foreground/40" />}
    </button>
  );
}
