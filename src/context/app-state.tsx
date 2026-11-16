import type {
  Biomarkers,
  Client,
  DiagnosticScan,
  EventLook,
  InventoryItem,
  LightingPreset,
  NewClientInput,
  Product,
  Profile,
  ScanCategory,
  SubscriptionTier,
  Workspace,
} from "@/lib/types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  MOCK_CATALOG,
  MOCK_CLIENTS,
  MOCK_INVENTORY,
  MOCK_LOOKS,
  MOCK_PROFILE,
  MOCK_SCANS,
} from "@/lib/mock-data";
import {
  approveLook as approveLookPure,
  lookForClient,
  sendLook as sendLookPure,
} from "@/lib/beauty";
import type { Gate, Usage } from "@/lib/plans";
import { clientGate, currentUsage, scanGate, shelfGate } from "@/lib/plans";
import type { RedeemResult, ReferralRewards, ReferralStats } from "@/lib/referrals";
import { makeReferralCode, redeemCode, referralRewards } from "@/lib/referrals";
import type { AccountState } from "@/lib/storage";
import { defaultAccount, loadAccount, saveAccount } from "@/lib/storage";

type AppState = {
  profile: Profile;
  workspace: Workspace;
  clients: Client[];
  scans: DiagnosticScan[];
  catalog: Product[];
  inventory: InventoryItem[];
  looks: EventLook[];
  /** Current plan. Device-local until accounts and payments exist. */
  tier: SubscriptionTier;
  setTier: (tier: SubscriptionTier) => void;
  /** This calendar month's usage; resets on the 1st. */
  usage: Usage;
  activeClients: Client[];
  shelfCount: number;
  referralCode: string;
  referredBy: string | null;
  referralStats: ReferralStats;
  rewards: ReferralRewards;
  affiliateCode: string | null;
  applyReferralCode: (code: string) => RedeemResult;
  activateAffiliate: () => string;
  setWorkspace: (workspace: Workspace) => void;
  /** Returns the blocking gate instead of a client when the active-client cap is reached. */
  addClient: (input: NewClientInput) => Client | Gate;
  archiveClient: (clientId: string) => void;
  /** Returns the blocking gate when restoring would exceed the active-client cap. */
  restoreClient: (clientId: string) => Gate;
  /** Returns the blocking gate instead of a scan when this month's check-ins are used up. */
  addScan: (input: {
    category: ScanCategory;
    biomarkers: Biomarkers;
    image_url: string;
    client_id?: string;
  }) => DiagnosticScan | Gate;
  /** Puts a product on / takes it off the shelf; returns the gate when the shelf is full. */
  toggleShelfProduct: (productId: string) => Gate;
  updateLook: (
    clientId: string,
    patch: Partial<
      Pick<
        EventLook,
        "occasion" | "lighting" | "skin_prep" | "hair_wig_style" | "nail_design" | "makeup_base"
      >
    >,
  ) => void;
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
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [account, setAccount] = useState<AccountState>(() => defaultAccount(new Date()));
  const [hydrated, setHydrated] = useState(false);

  // Load the saved plan and usage after mount so server and first client render match.
  useEffect(() => {
    setAccount(loadAccount(new Date()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveAccount(account);
  }, [account, hydrated]);

  const tier = account.tier;
  const usage = useMemo(() => currentUsage(account.usage, new Date()), [account.usage]);
  const activeClients = useMemo(() => clients.filter((client) => !client.archived), [clients]);
  const shelfCount = inventory.filter((item) => item.in_stock).length;
  const referralCode = useMemo(
    () => makeReferralCode(MOCK_PROFILE.display_name, MOCK_PROFILE.id),
    [],
  );
  // Real invite counts arrive with accounts; until then nobody has joined through this device.
  const referralStats = useMemo<ReferralStats>(() => ({ joinedThisMonth: 0, subscribed: 0 }), []);
  const rewards = useMemo(() => referralRewards(referralStats), [referralStats]);

  const setTier = useCallback((next: SubscriptionTier) => {
    setAccount((current) => ({ ...current, tier: next }));
  }, []);

  const applyReferralCode = useCallback(
    (code: string): RedeemResult => {
      const result = redeemCode(code, referralCode, account.referredBy);
      if (result.ok) setAccount((current) => ({ ...current, referredBy: result.code }));
      return result;
    },
    [account.referredBy, referralCode],
  );

  const activateAffiliate = useCallback((): string => {
    setAccount((current) => ({ ...current, affiliateCode: referralCode }));
    return referralCode;
  }, [referralCode]);
  const [looks, setLooks] = useState<EventLook[]>(MOCK_LOOKS);

  const addClient = useCallback(
    (input: NewClientInput): Client | Gate => {
      const gate = clientGate(tier, activeClients.length);
      if (!gate.allowed) return gate;
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
    },
    [tier, activeClients.length],
  );

  const archiveClient = useCallback((clientId: string) => {
    setClients((current) =>
      current.map((client) => (client.id === clientId ? { ...client, archived: true } : client)),
    );
  }, []);

  const restoreClient = useCallback(
    (clientId: string): Gate => {
      const gate = clientGate(tier, activeClients.length);
      if (!gate.allowed) return gate;
      setClients((current) =>
        current.map((client) => (client.id === clientId ? { ...client, archived: false } : client)),
      );
      return gate;
    },
    [tier, activeClients.length],
  );

  const toggleShelfProduct = useCallback(
    (productId: string): Gate => {
      const onShelf = inventory.some((item) => item.product_id === productId && item.in_stock);
      if (!onShelf) {
        const gate = shelfGate(tier, shelfCount);
        if (!gate.allowed) return gate;
      }
      setInventory((current) =>
        current.some((item) => item.product_id === productId)
          ? current.map((item) =>
              item.product_id === productId ? { ...item, in_stock: !onShelf } : item,
            )
          : [
              ...current,
              {
                id: nextId("inv"),
                user_id: MOCK_PROFILE.id,
                product_id: productId,
                in_stock: true,
              },
            ],
      );
      return { allowed: true };
    },
    [inventory, tier, shelfCount],
  );

  const addScan = useCallback(
    (input: {
      category: ScanCategory;
      biomarkers: Biomarkers;
      image_url: string;
      client_id?: string;
    }): DiagnosticScan | Gate => {
      const gate = scanGate(tier, usage.scans, rewards.bonusScans);
      if (!gate.allowed) return gate;
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
      setAccount((current) => {
        const live = currentUsage(current.usage, new Date());
        return { ...current, usage: { ...live, scans: live.scans + 1 } };
      });
      return scan;
    },
    [tier, usage.scans, rewards.bonusScans],
  );

  const updateLook = useCallback(
    (
      clientId: string,
      patch: Partial<
        Pick<
          EventLook,
          "occasion" | "lighting" | "skin_prep" | "hair_wig_style" | "nail_design" | "makeup_base"
        >
      >,
    ) => {
      setLooks((current) => {
        const existing = current.find((look) => look.client_id === clientId);
        if (existing) {
          return current.map((look) =>
            look.client_id === clientId ? { ...look, ...patch } : look,
          );
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
      current.map((look) =>
        look.client_id === clientId ? approveLookPure(look, clientNotes) : look,
      ),
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
      current.map((look) =>
        look.client_id === clientId ? { ...look, saved_to_history: true } : look,
      ),
    );
  }, []);

  const value = useMemo<AppState>(
    () => ({
      profile: { ...MOCK_PROFILE, subscription_tier: tier },
      workspace,
      tier,
      setTier,
      usage,
      activeClients,
      shelfCount,
      referralCode,
      referredBy: account.referredBy,
      referralStats,
      rewards,
      affiliateCode: account.affiliateCode,
      applyReferralCode,
      activateAffiliate,
      archiveClient,
      restoreClient,
      toggleShelfProduct,
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
    [
      tier,
      setTier,
      usage,
      activeClients,
      shelfCount,
      referralCode,
      account.referredBy,
      account.affiliateCode,
      referralStats,
      rewards,
      applyReferralCode,
      activateAffiliate,
      archiveClient,
      restoreClient,
      toggleShelfProduct,
      workspace,
      clients,
      scans,
      inventory,
      looks,
      addClient,
      addScan,
      updateLook,
      sendLookForClient,
      approveLookForClient,
      toggleLighting,
      saveLookToHistory,
    ],
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
