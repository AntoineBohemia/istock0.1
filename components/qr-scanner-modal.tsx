"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

import { parseProductQr } from "@/lib/utils/qr";
import { getRearCameraId } from "@/lib/utils/camera";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (productId: string) => void;
}

export default function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable refs for callbacks to avoid stale closures in scanner
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
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

        const scanner = new Html5Qrcode("qr-reader");
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
          if (productId) {
            stopScanner();
            onScanRef.current(productId);
            onCloseRef.current();
          } else {
            setError(`Format QR invalide.\nReçu: ${decodedText}`);
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

        if (mounted) {
          setIsStarting(false);
        }
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
  }, [open, stopScanner]);

  const handleClose = () => {
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
          Scanner un QR
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
        <div id="qr-reader" className="w-full h-full" style={{ minHeight: "300px" }} />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="size-64 rounded-3xl border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        </div>

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
      <div className="relative z-10 px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center">
        {error ? (
          <div className="rounded-xl bg-destructive/20 border border-destructive/30 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive text-left whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">Placez le QR code du produit dans le cadre</p>
        )}
      </div>
    </div>
  );
}
