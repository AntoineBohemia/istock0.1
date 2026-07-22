import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useIsBehindDialog } from "./dialog-stack";

describe("useIsBehindDialog", () => {
  it("laisse au premier plan une couche seule", () => {
    const only = renderHook(() => useIsBehindDialog());
    expect(only.result.current).toBe(false);
    only.unmount();
  });

  it("fait reculer la couche du dessous quand une autre s'ouvre", () => {
    const under = renderHook(() => useIsBehindDialog());
    const over = renderHook(() => useIsBehindDialog());

    expect(under.result.current).toBe(true);
    expect(over.result.current).toBe(false);

    under.unmount();
    over.unmount();
  });

  it("ramène la couche du dessous au premier plan quand celle du dessus se ferme", () => {
    const under = renderHook(() => useIsBehindDialog());
    const over = renderHook(() => useIsBehindDialog());
    expect(under.result.current).toBe(true);

    over.unmount();
    expect(under.result.current).toBe(false);

    under.unmount();
  });

  it("ne garde aucune trace d'une couche fermée hors ordre", () => {
    // Une modale du dessous peut se fermer avant celle du dessus — un panneau
    // qui se referme sous une confirmation, par exemple. La pile ne doit pas
    // designer une couche disparue comme etant celle du dessus.
    const under = renderHook(() => useIsBehindDialog());
    const over = renderHook(() => useIsBehindDialog());

    under.unmount();
    expect(over.result.current).toBe(false);

    over.unmount();

    const alone = renderHook(() => useIsBehindDialog());
    expect(alone.result.current).toBe(false);
    alone.unmount();
  });
});
