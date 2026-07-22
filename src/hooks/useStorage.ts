import { useContext } from "react";
import type { StorageAdapter } from "../types/storage";
import { StorageContext } from "../data/storageContextDefinition";

export function useStorage(): StorageAdapter {
  return useContext(StorageContext);
}
