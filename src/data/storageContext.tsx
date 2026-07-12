import { createContext, useContext, type ReactNode } from "react";
import type { StorageAdapter } from "../types/storage";
import { LocalStorageAdapter } from "./localStorageAdapter";

const defaultAdapter = new LocalStorageAdapter();

const StorageContext = createContext<StorageAdapter>(defaultAdapter);

export function StorageProvider({
  adapter = defaultAdapter,
  children,
}: {
  adapter?: StorageAdapter;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={adapter}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageAdapter {
  return useContext(StorageContext);
}
