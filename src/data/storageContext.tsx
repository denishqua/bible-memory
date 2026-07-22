import type { ReactNode } from "react";
import type { StorageAdapter } from "../types/storage";
import { StorageContext, defaultAdapter } from "./storageContextDefinition";

export function StorageProvider({
  adapter = defaultAdapter,
  children,
}: {
  adapter?: StorageAdapter;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={adapter}>{children}</StorageContext.Provider>;
}
