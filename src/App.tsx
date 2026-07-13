import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { StorageProvider } from "./data/storageContext";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { FlameStreakBadge } from "./components/ui/FlameStreakBadge";
import { useProfile } from "./hooks/useProfile";
import { LibraryPage } from "./pages/LibraryPage";
import { VerseDetailPage } from "./pages/VerseDetailPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CollectionDetailPage } from "./pages/CollectionDetailPage";
import { AddVersePage } from "./pages/AddVersePage";
import { ReviewPage } from "./pages/ReviewPage";
import { ImportPage } from "./pages/ImportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GatePage } from "./pages/GatePage";

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    textDecoration: "none",
    color: isActive ? "var(--color-clay)" : "var(--color-ink-muted)",
    fontWeight: isActive ? 600 : 500,
    fontSize: "0.95rem",
  };
}

function AppHeader() {
  const { profile } = useProfile();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <NavLink to="/" style={{ textDecoration: "none" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Bible Memory</h1>
      </NavLink>
      <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        <NavLink to="/" style={navLinkStyle} end>
          Library
        </NavLink>
        <NavLink to="/collections" style={navLinkStyle}>
          Collections
        </NavLink>
        <NavLink to="/settings" style={navLinkStyle}>
          Settings
        </NavLink>
        <FlameStreakBadge streak={profile?.streak.currentStreak ?? 0} />
        <ThemeToggle />
      </nav>
    </header>
  );
}

// Header + routed content. Split out of App so useLocation (which must run
// inside HashRouter) can hide the app chrome on the distraction-free /gate
// page — the extension's verse gate renders full-screen with no navigation.
function AppLayout() {
  const location = useLocation();
  const isGate = location.pathname === "/gate";

  return (
    <>
      {!isGate && <AppHeader />}
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: "72rem", margin: "0 auto", width: "100%" }}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/verse/:id" element={<VerseDetailPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/add" element={<AddVersePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/gate" element={<GatePage />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <StorageProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
    </StorageProvider>
  );
}

export default App;
