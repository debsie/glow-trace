import type { Biomarkers, Client, DiagnosticScan, EventLook, InventoryItem, LightingPreset, NewClientInput, Product, Profile, ScanCategory, Workspace } from "@/lib/types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  MOCK_CATALOG,
  MOCK_CLIENTS,
  MOCK_INVENTORY,
  MOCK_LOOKS,
  MOCK_PROFILE,
  MOCK_SCANS,
} from "@/lib/mock-data";
import { approveLook as approveLookPure, lookForClient, sendLook as sendLookPure } from "@/lib/beauty";

type AppState = {
  profile: Profile;
  workspace: Workspace;
  clients: Client[];
  scans: DiagnosticScan[];
  catalog: Product[];
  inventory: InventoryItem[];
  looks: EventLook[];
  setWorkspace: (workspace: Workspace) => void;
  addClient: (input: NewClientInput) => Client;
  addScan: (input: { category: ScanCategory; biomarkers: Biomarkers; image_url: string; client_id?: string }) => DiagnosticScan;
  updateLook: (clientId: string, patch: Partial<Pick<EventLook, "occasion" | "lighting" | "hair_wig_style" | "nail_design" | "makeup_base">>) => void;
  sendLookForClient: (clientId: string) => void;
  approveLookForClient: (clientId: string, clientNotes?: string) => void;
  toggleLighting: (clientId: string, preset: LightingPreset) => void;
  saveLookToHistory: (clientId: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

let idCounter = 0;
const nextId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
};

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [workspace, setWorkspace] = useState<Workspace>("personal");
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [scans, setScans] = useState<DiagnosticScan[]>(MOCK_SCANS);
  const [inventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [looks, setLooks] = useState<EventLook[]>(MOCK_LOOKS);

  const addClient = useCallback((input: NewClientInput): Client => {
    const client: Client = {
      id: nextId("c"),
      mua_id: MOCK_PROFILE.id,
      client_name: input.client_name.trim() || "Unnamed client",
      contact_info: input.contact_info.trim(),
      skin_type: input.skin_type.trim() || "Undiagnosed",
      notes: input.notes.trim(),
    };
    setClients((current) => [client, ...current]);
    return client;
  }, []);

  const addScan = useCallback(
    (input: { category: ScanCategory; biomarkers: Biomarkers; image_url: string; client_id?: string }): DiagnosticScan => {
      const scan: DiagnosticScan = {
        id: nextId("s"),
        user_id: MOCK_PROFILE.id,
        category: input.category,
        biomarkers: input.biomarkers,
        image_url: input.image_url,
        created_at: new Date().toISOString(),
        ...(input.client_id ? { client_id: input.client_id } : {}),
      };
      setScans((current) => [scan, ...current]);
      return scan;
    },
    [],
  );

  const updateLook = useCallback(
    (
      clientId: string,
      patch: Partial<Pick<EventLook, "occasion" | "lighting" | "hair_wig_style" | "nail_design" | "makeup_base">>,
    ) => {
      setLooks((current) => {
        const existing = current.find((look) => look.client_id === clientId);
        if (existing) {
          return current.map((look) => (look.client_id === clientId ? { ...look, ...patch } : look));
        }
        const fresh: EventLook = {
          id: nextId("look"),
          client_id: clientId,
          occasion: "HD Film",
          lighting: ["Studio Flash"],
          skin_prep: ["Cleanse", "Treat", "Moisturize", "Prime"],
          makeup_base: "Neutral Cool — Satin Finish, buildable medium coverage",
          hair_wig_style: "Silk-top lace wig · heat protectant pass, matte finish",
          nail_design: "Chrome Velvet Almond Finish",
          status: "drafting",
          approved: false,
          ...patch,
        };
        return [fresh, ...current];
      });
    },
    [],
  );

  const sendLookForClient = useCallback((clientId: string) => {
    setLooks((current) =>
      current.map((look) => (look.client_id === clientId ? sendLookPure(look) : look)),
    );
  }, []);

  const approveLookForClient = useCallback((clientId: string, clientNotes?: string) => {
    setLooks((current) =>
      current.map((look) => (look.client_id === clientId ? approveLookPure(look, clientNotes) : look)),
    );
  }, []);

  const toggleLighting = useCallback((clientId: string, preset: LightingPreset) => {
    setLooks((current) =>
      current.map((look) =>
        look.client_id === clientId
          ? {
              ...look,
              lighting: look.lighting.includes(preset)
                ? look.lighting.filter((l) => l !== preset)
                : [...look.lighting, preset],
            }
          : look,
      ),
    );
  }, []);

  const saveLookToHistory = useCallback((clientId: string) => {
    setLooks((current) =>
      current.map((look) => (look.client_id === clientId ? { ...look, saved_to_history: true } : look)),
    );
  }, []);

  const value = useMemo<AppState>(
    () => ({
      profile: MOCK_PROFILE,
      workspace,
      clients,
      scans,
      catalog: MOCK_CATALOG,
      inventory,
      looks,
      setWorkspace,
      addClient,
      addScan,
      updateLook,
      sendLookForClient,
      approveLookForClient,
      toggleLighting,
      saveLookToHistory,
    }),
    [workspace, clients, scans, inventory, looks, addClient, addScan, updateLook, sendLookForClient, approveLookForClient, toggleLighting, saveLookToHistory],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = (): AppState => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
};

export const useClient = (clientId: string): Client | undefined => {
  const { clients } = useAppState();
  return clients.find((client) => client.id === clientId);
};

export const useClientLook = (clientId: string): EventLook | undefined => {
  const { looks } = useAppState();
  return lookForClient(looks, clientId);
};
