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
      if (mounted) {
        setError(null);
        setIsStarting(true);
      }
      try {
        // Wait for DOM to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!mounted || !containerRef.current) return;
        if (!document.getElementById(readerId)) {
          // Sans ce garde-fou, html5-qrcode leve une erreur brute et l'ecran
          // reste noir sans explication.
          setError("La zone de capture n'a pas pu être initialisée.");
          setIsStarting(false);
          return;
        }

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

        // Try to get rear camera by deviceId (most reliable on iPhone)
        const rearId = await getRearCameraId();

        if (rearId) {
          await scanner.start({ deviceId: { exact: rearId } }, scanConfig, onSuccess, onFailure);
        } else {
          await scanner.start({ facingMode: "environment" }, scanConfig, onSuccess, onFailure);
        }

        // Le demarrage prend pres d'une seconde. Si l'ecran s'est ferme entre
        // temps, le nettoyage est deja passe sans rien trouver a arreter : on
        // eteint ici, sinon la camera tourne jusqu'au rechargement de la page.
        if (!mounted) {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            // Rien a rattraper.
          }
          return;
        }

        setIsStarting(false);
      } catch (err) {
        if (!mounted) return;

        setIsStarting(false);

        if (err instanceof Error) {
          if (err.message.includes("Permission") || err.message.includes("NotAllowedError")) {
            setError(
              "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
            );
          } else if (err.message.includes("NotFoundError")) {
            setError("Aucune caméra détectée sur cet appareil.");
          } else {
            setError(`Erreur: ${err.message}`);
          }
        } else {
          setError("Une erreur inattendue s'est produite.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [open, stopScanner, readerId]);

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
          <div className="rounded-xl bg-destructive/20 border border-destructive/30 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive text-left whitespace-pre-wrap">{error}</p>
            </div>
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
