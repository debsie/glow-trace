import type {
  Biomarkers,
  Client,
  ScanRecord,
  EventLook,
  InventoryItem,
  LightingPreset,
  NewClientInput,
  Product,
  Profile,
  ScanCategory,
  ScanReport,
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
import { makeReferralCode, redeemCode, referralRewards, streakBonusScans } from "@/lib/referrals";
import type { AccountState } from "@/lib/storage";
import { useAuth } from "@/context/auth";
import { weeklyStreak } from "@/lib/engagement";
import { clearAccount, defaultAccount, loadAccount, saveAccount } from "@/lib/storage";
import type { SamplePhotos } from "@/lib/vault";
import { buildExport, fromVault, parseVault, toVault } from "@/lib/vault";
import {
  blobToDataUrl,
  clearAll,
  getPhotos,
  prunePhotos,
  putPhoto,
  readVaultRaw,
  storageAvailable,
  writeVaultRaw,
} from "@/lib/vault-store";

import scanSkin from "@/assets/scan-skin.jpg";
import scanHair from "@/assets/scan-hair.jpg";
import scanNails from "@/assets/scan-nails.jpg";

const SAMPLE_PHOTOS: SamplePhotos = { skin: scanSkin, hair: scanHair, nails: scanNails };

/** "loading" until the device store is read; "unavailable" in private modes that block it. */
export type StorageStatus = "loading" | "saved" | "unavailable";

type AppState = {
  profile: Profile;
  workspace: Workspace;
  clients: Client[];
  scans: ScanRecord[];
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
    report?: ScanReport | undefined;
    demo?: boolean | undefined;
    /** Compact copy of the photo to keep in the on-device history. */
    photo?: Blob | undefined;
  }) => ScanRecord | Gate;
  storageStatus: StorageStatus;
  /** Everything stored on this device, as a portable JSON-ready object. */
  exportData: () => Promise<unknown>;
  /** Erase every scan, photo, client, lookbook and setting on this device. */
  deleteAllData: () => Promise<void>;
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
  const [scans, setScans] = useState<ScanRecord[]>(MOCK_SCANS);
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [account, setAccount] = useState<AccountState>(() => defaultAccount(new Date()));
  const [hydrated, setHydrated] = useState(false);

  // Signed-in beta members see their own name and id; demo mode keeps the sample profile.
  const { access, isAdmin } = useAuth();
  const me = useMemo(
    () =>
      access.kind === "member"
        ? {
            ...MOCK_PROFILE,
            id: access.userId,
            email: access.email,
            display_name: access.displayName,
          }
        : MOCK_PROFILE,
    [access],
  );

  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");

  // Load the saved plan and usage after mount so server and first client render match.
  useEffect(() => {
    setAccount(loadAccount(new Date()));
    setHydrated(true);
  }, []);

  // Load the on-device vault. First visit: the sample data stays and is saved as the start.
  useEffect(() => {
    if (!storageAvailable()) {
      setStorageStatus("unavailable");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const vault = parseVault(await readVaultRaw());
        if (vault && !cancelled) {
          const stored = vault.scans.filter((scan) => scan.sample_photo === null).map((s) => s.id);
          const blobs = await getPhotos(stored);
          const urls = new Map([...blobs].map(([id, blob]) => [id, URL.createObjectURL(blob)]));
          if (cancelled) return;
          const data = fromVault(vault, SAMPLE_PHOTOS, urls);
          setScans(data.scans);
          setClients(data.clients);
          setLooks(data.looks);
          setInventory(data.inventory);
        }
        if (!cancelled) setStorageStatus("saved");
      } catch {
        if (!cancelled) setStorageStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveAccount(account);
  }, [account, hydrated]);

  // Admins always get the top tier so they can test every feature. UI only: no payments exist yet.
  const tier: SubscriptionTier = isAdmin ? "studio" : account.tier;
  const usage = useMemo(() => currentUsage(account.usage, new Date()), [account.usage]);
  const activeClients = useMemo(() => clients.filter((client) => !client.archived), [clients]);
  const shelfCount = inventory.filter((item) => item.in_stock).length;
  const referralCode = useMemo(
    () => makeReferralCode(me.display_name, me.id),
    [me.display_name, me.id],
  );
  // Real invite counts arrive with accounts; until then nobody has joined through this device.
  const referralStats = useMemo<ReferralStats>(() => ({ joinedThisMonth: 0, subscribed: 0 }), []);
  // Referral bonus plus the weekly-streak bonus (referrals.ts holds both rules).
  const rewards = useMemo(() => {
    const base = referralRewards(referralStats);
    return {
      ...base,
      bonusScans: base.bonusScans + streakBonusScans(weeklyStreak(scans, new Date())),
    };
  }, [referralStats, scans]);

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
        mua_id: me.id,
        client_name: input.client_name.trim() || "Unnamed client",
        contact_info: input.contact_info.trim(),
        skin_type: input.skin_type.trim() || "Not assessed",
        notes: input.notes.trim(),
      };
      setClients((current) => [client, ...current]);
      return client;
    },
    [tier, activeClients.length, me.id],
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
                user_id: me.id,
                product_id: productId,
                in_stock: true,
              },
            ],
      );
      return { allowed: true };
    },
    [inventory, tier, shelfCount, me.id],
  );

  const addScan = useCallback(
    (input: {
      category: ScanCategory;
      biomarkers: Biomarkers;
      image_url: string;
      client_id?: string;
      report?: ScanReport | undefined;
      demo?: boolean | undefined;
      photo?: Blob | undefined;
    }): ScanRecord | Gate => {
      const gate = scanGate(tier, usage.scans, rewards.bonusScans);
      if (!gate.allowed) return gate;
      const id = nextId("s");
      let imageUrl = input.image_url;
      if (input.photo) {
        imageUrl = URL.createObjectURL(input.photo);
        if (storageAvailable()) void putPhoto(id, input.photo).catch(() => undefined);
      }
      const scan: ScanRecord = {
        id,
        user_id: me.id,
        category: input.category,
        biomarkers: input.biomarkers,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        ...(input.client_id ? { client_id: input.client_id } : {}),
        ...(input.report ? { report: input.report } : {}),
        ...(input.demo ? { demo: true } : {}),
      };
      setScans((current) => [scan, ...current]);
      setAccount((current) => {
        const live = currentUsage(current.usage, new Date());
        return { ...current, usage: { ...live, scans: live.scans + 1 } };
      });
      return scan;
    },
    [tier, usage.scans, rewards.bonusScans, me.id],
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

  // Save every change to the on-device vault (debounced), and drop photos nothing points at.
  useEffect(() => {
    if (storageStatus !== "saved") return;
    const timer = window.setTimeout(() => {
      const vault = toVault({ scans, clients, looks, inventory }, SAMPLE_PHOTOS, new Date());
      void writeVaultRaw(vault)
        .then(() => prunePhotos(new Set(scans.map((scan) => scan.id))))
        .catch(() => setStorageStatus("unavailable"));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [scans, clients, looks, inventory, storageStatus]);

  const exportData = useCallback(async (): Promise<unknown> => {
    const vault = toVault({ scans, clients, looks, inventory }, SAMPLE_PHOTOS, new Date());
    const photos: Record<string, string> = {};
    if (storageAvailable()) {
      const ids = vault.scans.filter((scan) => scan.sample_photo === null).map((scan) => scan.id);
      for (const [id, blob] of await getPhotos(ids)) photos[id] = await blobToDataUrl(blob);
    }
    return { ...buildExport(vault, photos), account };
  }, [scans, clients, looks, inventory, account]);

  const deleteAllData = useCallback(async (): Promise<void> => {
    if (storageAvailable()) await clearAll();
    clearAccount();
    scans.forEach((scan) => {
      if (scan.image_url.startsWith("blob:")) URL.revokeObjectURL(scan.image_url);
    });
    setScans([]);
    setClients([]);
    setLooks([]);
    setInventory([]);
    setAccount(defaultAccount(new Date()));
    // Re-creates an empty vault, so the sample data does not come back on the next visit.
    setStorageStatus(storageAvailable() ? "saved" : "unavailable");
  }, [scans]);

  const value = useMemo<AppState>(
    () => ({
      profile: { ...me, subscription_tier: tier },
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
      storageStatus,
      exportData,
      deleteAllData,
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
      me,
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
      storageStatus,
      exportData,
      deleteAllData,
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
