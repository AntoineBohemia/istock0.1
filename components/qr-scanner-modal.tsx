"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseProductQr } from "@/lib/utils/qr";
import { getRearCameraId } from "@/lib/utils/camera";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (productId: string) => void;
}

export default function QrScannerModal({
  open,
  onClose,
  onScan,
}: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable refs for callbacks to avoid stale closures in scanner
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

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
    setError(null);
    setIsStarting(true);

    const startScanner = async () => {
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
        const onFailure = () => {/* no QR in frame - ignore */};

        // Try to get rear camera by deviceId (most reliable on iPhone)
        const rearId = await getRearCameraId();

        if (rearId) {
          await scanner.start(
            { deviceId: { exact: rearId } },
            scanConfig, onSuccess, onFailure
          );
        } else {
          await scanner.start(
            { facingMode: "environment" },
            scanConfig, onSuccess, onFailure
          );
        }

        if (mounted) {
          setIsStarting(false);
        }
      } catch (err) {
        if (!mounted) return;

        setIsStarting(false);

        if (err instanceof Error) {
          if (
            err.message.includes("Permission") ||
            err.message.includes("NotAllowedError")
          ) {
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" />
            Scanner un QR Code
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            <X className="size-4" />
            <span className="sr-only">Fermer</span>
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="whitespace-pre-wrap">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-black"
          >
            <div
              id="qr-reader"
              className="w-full"
              style={{ minHeight: "300px" }}
            />

            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <Camera className="mx-auto size-8 animate-pulse" />
                  <p className="mt-2 text-sm">Démarrage de la caméra...</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Placez le QR code du produit dans le cadre
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
