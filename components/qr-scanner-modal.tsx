"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

import { parseProductQr } from "@/lib/utils/qr";
import { getRearCameraId } from "@/lib/utils/camera";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (productId: string) => void;
  /** When true, scanner stays open after each scan (batch mode) */
  continuous?: boolean;
  /** Label shown in top bar (defaults to "Scanner un QR") */
  title?: string;
  /** Content shown at the bottom */
  bottomContent?: React.ReactNode;
}

export default function QrScannerModal({
  open,
  onClose,
  onScan,
  continuous = false,
  title,
  bottomContent,
}: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  // Une autorisation refusee puis accordee dans les reglages ne se reprend pas
  // toute seule : il faut relancer le demarrage sans quitter l'ecran.
  const [retryCount, setRetryCount] = useState(0);
  const [scanFlash, setScanFlash] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Identifiant propre a l'instance : « qr-reader » etait code en dur, donc
  // deux lecteurs montes en meme temps visaient le meme noeud.
  const readerId = `qr-reader-${useId().replace(/:/g, "")}`;
  const lastScanTime = useRef(0);
  const continuousRef = useRef(continuous);
  useEffect(() => {
    continuousRef.current = continuous;
  });

  // Stable refs for callbacks to avoid stale closures in scanner
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      // On tente l'arret quel que soit l'etat declare. L'ancien code ne
      // stoppait que l'etat SCANNING : ferme pendant le demarrage, la camera
      // restait allumee et la reouverture creait un second lecteur sur le
      // meme flux — d'ou le plantage.
      await scanner.stop();
    } catch {
      // Deja arrete, ou jamais demarre : rien a faire.
    }
    try {
      // Libere le noeud DOM, sinon le lecteur suivant heriterait du canvas
      // du precedent.
      scanner.clear();
    } catch {
      // Idem.
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const startScanner = async () => {
      if (!mounted) return;
      setError(null);
      setIsStarting(true);

      try {
        // ── 1. Contexte securise ──
        // Sans HTTPS, navigator.mediaDevices n'existe pas et l'appel plante
        // sans rien dire. C'est le cas d'un test par adresse IP locale
        // (http://192.168.x.x), ou la camera est tout simplement interdite.
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setError(
            window.isSecureContext === false
              ? "La caméra exige une connexion sécurisée (https). Ouvrez l'application par son adresse https:// — un accès par adresse IP locale ne l'autorise pas."
              : "Ce navigateur ne donne pas accès à la caméra."
          );
          setIsStarting(false);
          return;
        }

        // ── 2. Zone de capture ──
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (!mounted) return;
        if (!document.getElementById(readerId)) {
          setError("La zone de capture n'a pas pu être initialisée.");
          setIsStarting(false);
          return;
        }

        // ── 3. Autorisation, demandee explicitement ──
        // On ouvre nous-memes un flux avant de laisser html5-qrcode faire :
        // la demande d'autorisation vient alors du geste de l'utilisateur, et
        // un refus se distingue d'une panne. Le flux est referme aussitot,
        // la bibliotheque rouvrira le sien.
        try {
          const probe = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          probe.getTracks().forEach((t) => t.stop());
        } catch (permErr) {
          if (!mounted) return;
          const name = (permErr as { name?: string })?.name;
          setIsStarting(false);
          if (name === "NotAllowedError" || name === "SecurityError") {
            setError(
              "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, puis réessayez."
            );
          } else if (name === "NotFoundError" || name === "OverconstrainedError") {
            setError("Aucune caméra arrière détectée sur cet appareil.");
          } else if (name === "NotReadableError") {
            setError("La caméra est déjà utilisée par une autre application.");
          } else {
            setError(`Caméra indisponible${name ? ` (${name})` : ""}.`);
          }
          return;
        }

        if (!mounted) return;

        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;

        const scanConfig = {
          fps: 5,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.7;
            return { width: size, height: size };
          },
        };
        const onSuccess = (decodedText: string) => {
          const productId = parseProductQr(decodedText);
          if (!productId) {
            setError(`Format QR invalide.\nReçu: ${decodedText}`);
            return;
          }

          if (continuousRef.current) {
            // Continuous mode: cooldown 2s between scans, don't close
            const now = Date.now();
            if (now - lastScanTime.current < 2000) return;
            lastScanTime.current = now;
            navigator.vibrate?.(15);
            setScanFlash(true);
            setTimeout(() => setScanFlash(false), 300);
            onScanRef.current(productId);
          } else {
            // Single mode: scan once and close
            stopScanner();
            onScanRef.current(productId);
            onCloseRef.current();
          }
        };
        const onFailure = () => {
          /* no QR in frame - ignore */
        };

        // ── 4. Demarrage, avec repli ──
        // Les identifiants de camera changent d'une session a l'autre sur iOS.
        // « exact » echouait alors en OverconstrainedError et l'ancien code
        // partait droit au catch, sans jamais essayer facingMode : ecran noir.
        const rearId = await getRearCameraId();
        const attempts: Parameters<Html5Qrcode["start"]>[0][] = [];
        if (rearId) attempts.push({ deviceId: { exact: rearId } });
        attempts.push({ facingMode: "environment" });
        attempts.push({ facingMode: "user" });

        let started = false;
        let lastErr: unknown = null;
        for (const source of attempts) {
          try {
            await scanner.start(source, scanConfig, onSuccess, onFailure);
            started = true;
            break;
          } catch (attemptErr) {
            lastErr = attemptErr;
            if (!mounted) break;
          }
        }

        // Ferme pendant le demarrage : on eteint nous-memes, le nettoyage est
        // deja passe sans rien trouver a arreter.
        if (!mounted) {
          if (started) {
            try {
              await scanner.stop();
              scanner.clear();
            } catch {
              /* rien a rattraper */
            }
          }
          return;
        }

        if (!started) throw lastErr ?? new Error("Démarrage impossible");

        setIsStarting(false);
      } catch (err) {
        if (!mounted) return;
        setIsStarting(false);
        // html5-qrcode rejette parfois avec une simple chaine : tester
        // instanceof Error masquait le vrai message derriere « une erreur
        // inattendue s'est produite », et l'ecran restait noir sans indice.
        const detail =
          err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
        setError(`La caméra n'a pas pu démarrer.\n${detail}`);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [open, stopScanner, readerId, retryCount]);

  // Track if close was already handled (to avoid double-firing onClose)
  const closedByHandleClose = useRef(false);

  // When open transitions to false externally (not via X button), fire onClose
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open && !closedByHandleClose.current) {
      stopScanner();
      onCloseRef.current();
    }
    if (open) closedByHandleClose.current = false;
    prevOpenRef.current = open;
  }, [open, stopScanner]);

  const handleClose = () => {
    closedByHandleClose.current = true;
    stopScanner();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* ── Top bar ── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <h2 className="text-white font-semibold text-base flex items-center gap-2">
          <Camera className="size-5" />
          {title || "Scanner un QR"}
        </h2>
        <button
          onClick={handleClose}
          className="text-white/80 active:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* ── Camera feed ── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div id={readerId} className="w-full h-full" style={{ minHeight: "300px" }} />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className={`size-64 rounded-3xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-colors duration-200 ${scanFlash ? "border-green-400" : "border-white/40"}`}
          />
        </div>

        {/* Green flash on successful scan (continuous mode) */}
        {scanFlash && (
          <div className="absolute inset-0 bg-green-500/10 pointer-events-none animate-pulse" />
        )}

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white">
              <Camera className="mx-auto size-10 animate-pulse" />
              <p className="mt-3 text-sm font-medium">Demarrage de la camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom info ── */}
      <div className="relative z-10 px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-3">
        {error ? (
          <div className="rounded-xl bg-destructive/20 border border-destructive/30 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive text-left whitespace-pre-wrap">{error}</p>
            </div>
            <button
              onClick={() => {
                stopScanner();
                setRetryCount((n) => n + 1);
              }}
              className="w-full rounded-lg bg-white py-2.5 text-base font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <p className="text-white/60 text-sm text-center">
            Placez le QR code du produit dans le cadre
          </p>
        )}
        {bottomContent}
      </div>
    </div>
  );
}
