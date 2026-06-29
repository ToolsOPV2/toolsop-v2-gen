import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SUPPORT_URL = import.meta.env.VITE_DISCORD_SUPPORT_URL || "";

const services = [
  { icon: "🎮", name: "Steam", status: "Disponible" },
  { icon: "🎬", name: "Disney", status: "Disponible" },
  { icon: "📺", name: "Netflix", status: "Disponible" },
  { icon: "🎯", name: "Fortnite", status: "Disponible" },
  { icon: "🟢", name: "Xbox", status: "Disponible" },
  { icon: "✉️", name: "Hotmail", status: "Disponible" },
  { icon: "🎵", name: "Deezer", status: "Disponible" },
  { icon: "💳", name: "Nitro Uncheck", status: "Disponible" },
];

function App() {
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("import");
  const [selectedService, setSelectedService] = useState("Steam");
  const [bulkText, setBulkText] = useState("");
  const [importStatus, setImportStatus] = useState("");

  const [stats, setStats] = useState(null);
  const [generatedResource, setGeneratedResource] = useState("");
  const [resultOpen, setResultOpen] = useState(false);

  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyServiceFilter, setHistoryServiceFilter] = useState("Tous");

  const [serviceSettings, setServiceSettings] = useState({});
  const [vipLockStatus, setVipLockStatus] = useState("");
  const [lastDailyInfo, setLastDailyInfo] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [resetCountdown, setResetCountdown] = useState("");

  const loadStats = () => {
    fetch(`${API_URL}/api/stats`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  };

  const loadServiceSettings = () => {
    fetch(`${API_URL}/api/service-settings`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setServiceSettings(data.settings || {});
      })
      .catch(() => {
        setServiceSettings({});
      });
  };

  const loadUsageInfo = () => {
    fetch(`${API_URL}/api/usage`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsageInfo(data);
        } else {
          setUsageInfo(null);
        }
      })
      .catch(() => {
        setUsageInfo(null);
      });
  };

  const loadHistory = async () => {
    try {
      setHistoryStatus("Chargement de l'historique...");

      const response = await fetch(`${API_URL}/api/history`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setHistoryStatus(data.error || "Impossible de charger l'historique.");
        return;
      }

      setHistory(data.history || []);
      setHistoryStatus("");
    } catch (error) {
      console.error(error);
      setHistoryStatus("Impossible de contacter le serveur.");
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/me`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setLoggedIn(data.loggedIn);
        setUser(data.user);

        if (data.loggedIn) {
          loadUsageInfo();
        } else {
          setUsageInfo(null);
        }
      })
      .catch(() => {
        setLoggedIn(false);
        setUser(null);
        setUsageInfo(null);
      });

    loadStats();
    loadServiceSettings();
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);

      if (remaining <= 0) {
        setCooldownUntil(null);
        setCooldownRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!usageInfo?.resetAt) {
      setResetCountdown("");
      return;
    }

    const updateCountdown = () => {
      const remaining = new Date(usageInfo.resetAt).getTime() - Date.now();

      if (remaining <= 0) {
        setResetCountdown("bientôt");
        return;
      }

      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      setResetCountdown(`${hours}h ${String(minutes).padStart(2, "0")}min`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);

    return () => clearInterval(interval);
  }, [usageInfo?.resetAt]);

  const formatCooldown = (ms) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Date inconnue";

    return new Date(dateValue).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const getServiceIcon = (serviceName) => {
    return services.find((service) => service.name === serviceName)?.icon || "✨";
  };

  const handleOpenSupport = () => {
    if (!SUPPORT_URL) {
      alert(
        "Ajoute VITE_DISCORD_SUPPORT_URL dans Vercel avec le lien de ton salon/ticket Discord."
      );
      return;
    }

    window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
  };

  const handleDiscordLogin = () => {
    window.location.href = `${API_URL}/auth/discord`;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error(error);
    }

    setLoggedIn(false);
    setUser(null);
    setUsageInfo(null);
    setLastDailyInfo(null);
  };

  const handleAdminAccess = () => {
    if (!loggedIn) {
      handleDiscordLogin();
      return;
    }

    if (user?.isAdmin === true) {
      setAdminOpen(true);
      setAccessError("");
      loadHistory();
      loadServiceSettings();
      loadStats();
    } else {
      setAccessError("Accès refusé : tu n’as pas le rôle admin Discord.");
    }
  };

  const handleImport = async () => {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setImportStatus("Ajoute au moins une ressource.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/resources/import`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: selectedService,
          items: lines,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setImportStatus(data.error || "Erreur pendant l'import.");
        return;
      }

      setImportStatus(
        `${data.added} ressource(s) importée(s) pour ${selectedService}.`
      );

      setBulkText("");
      loadStats();
      loadHistory();
      loadUsageInfo();
    } catch (error) {
      console.error(error);
      setImportStatus("Impossible de contacter le serveur.");
    }
  };

  const handleUpdateServiceSettings = async (serviceName, updates) => {
    try {
      setVipLockStatus("Modification en cours...");

      const response = await fetch(`${API_URL}/api/service-settings/${serviceName}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        setVipLockStatus(data.error || "Erreur pendant la modification.");
        return;
      }

      setServiceSettings((previous) => ({
        ...previous,
        [serviceName]: {
          ...(previous[serviceName] || {}),
          vipOnly: data.vipOnly === true,
          maintenance: data.maintenance === true,
        },
      }));

      setVipLockStatus(`${serviceName} mis à jour avec succès.`);
      loadServiceSettings();
    } catch (error) {
      console.error(error);
      setVipLockStatus("Impossible de contacter le serveur.");
    }
  };

  const handleGenerate = async (serviceName) => {
    if (!loggedIn) {
      handleDiscordLogin();
      return;
    }

    const vipOnly = serviceSettings?.[serviceName]?.vipOnly === true;
    const maintenance = serviceSettings?.[serviceName]?.maintenance === true;
    const userIsVip = user?.isVip === true;
    const stock = getStock(serviceName);

    if (maintenance) {
      alert("Ce service est actuellement en maintenance.");
      return;
    }

    if (stock <= 0) {
      alert("Ce service est en rupture de stock.");
      return;
    }

    if (vipOnly && !userIsVip) {
      alert("Ce service est uniquement disponible pour les membres VIP.");
      return;
    }

    if (cooldownRemaining > 0) {
      alert(`Tu dois attendre ${formatCooldown(cooldownRemaining)}.`);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: serviceName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.cooldownRemainingMs) {
          setCooldownUntil(Date.now() + data.cooldownRemainingMs);
          alert(`Tu dois attendre ${formatCooldown(data.cooldownRemainingMs)}.`);
          return;
        }

        if (data.dailyLimit !== undefined) {
          setLastDailyInfo({
            dailyLimit: data.dailyLimit,
            dailyUsed: data.dailyUsed,
            dailyRemaining: data.dailyRemaining,
            resetAt: data.resetAt,
          });
          loadUsageInfo();
        }

        alert(data.error || "Erreur pendant la génération.");
        return;
      }

      setGeneratedResource(`${data.service} : ${data.resource}`);
      setResultOpen(true);

      setLastDailyInfo({
        dailyLimit: data.dailyLimit,
        dailyUsed: data.dailyUsed,
        dailyRemaining: data.dailyRemaining,
        resetAt: data.resetAt,
      });

      const cooldownMs = data.cooldownMs || 5 * 60 * 1000;
      setCooldownUntil(Date.now() + cooldownMs);

      loadStats();
      loadHistory();
      loadUsageInfo();
    } catch (error) {
      console.error(error);
      alert("Impossible de contacter le serveur.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedResource);
      alert("Code copié !");
    } catch {
      alert("Impossible de copier automatiquement.");
    }
  };

  const getStock = (serviceName) => {
    return stats?.byService?.[serviceName] ?? 0;
  };

  const getServiceBadge = (serviceName) => {
    const stock = getStock(serviceName);
    const settings = serviceSettings?.[serviceName] || {};

    if (settings.maintenance) {
      return { label: "Maintenance", color: "#ff6b6b" };
    }

    if (stock <= 0) {
      return { label: "Rupture", color: "#ff6b6b" };
    }

    if (settings.vipOnly) {
      return { label: "VIP uniquement", color: "#ffcc00" };
    }

    if (stock <= 5) {
      return { label: "Stock faible", color: "#ff8c00" };
    }

    return { label: "Public", color: "#66ff99" };
  };

  const popularServices = useMemo(() => {
    const fromBackend = Array.isArray(stats?.popularServices)
      ? stats.popularServices
      : [];

    if (fromBackend.length > 0) {
      return fromBackend
        .map((item) => ({
          ...item,
          icon: getServiceIcon(item.service),
        }))
        .slice(0, 3);
    }

    return [...services]
      .map((service) => ({
        service: service.name,
        icon: service.icon,
        count: 0,
        stock: getStock(service.name),
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 3);
  }, [stats]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();

    return history.filter((item) => {
      const matchService =
        historyServiceFilter === "Tous" || item.service === historyServiceFilter;

      const matchSearch =
        !query ||
        String(item.username || "").toLowerCase().includes(query) ||
        String(item.user_id || "").toLowerCase().includes(query) ||
        String(item.service || "").toLowerCase().includes(query) ||
        String(item.resource_value || "").toLowerCase().includes(query);

      return matchService && matchSearch;
    });
  }, [history, historySearch, historyServiceFilter]);

  const exportHistoryCsv = () => {
    const rows = [
      ["Membre", "Service", "Ressource", "Date"],
      ...filteredHistory.map((item) => [
        item.username || item.user_id || "Utilisateur",
        item.service || "",
        item.resource_value || "Ancienne génération non stockée",
        formatDate(item.created_at),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historique-toolsop.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderAccountCard = () => {
    if (!loggedIn) {
      return null;
    }

    return (
      <div
        className="glass"
        style={{
          marginTop: "18px",
          padding: "18px",
          borderRadius: "20px",
          display: "grid",
          gap: "12px",
          background: "rgba(255, 255, 255, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "14px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: "18px" }}>
              Mon compte : {user?.username}
            </strong>
            <p style={{ margin: "6px 0 0", opacity: 0.8 }}>
              Accès : {usageInfo?.plan || "Chargement..."}
            </p>
          </div>

          <button className="secondary-button" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>

        {usageInfo ? (
          <>
            {usageInfo.unlimited ? (
              <p style={{ margin: 0, color: "#ffcc00", fontWeight: "900" }}>
                ♾️ Générations illimitées aujourd’hui
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Générations :{" "}
                <strong>
                  {usageInfo.dailyUsed}/{usageInfo.dailyLimit}
                </strong>{" "}
                — Restantes : <strong>{usageInfo.dailyRemaining}</strong>
              </p>
            )}

            <p style={{ margin: 0, opacity: 0.82 }}>
              Cooldown : {Math.round((usageInfo.cooldownMs || 0) / 60000)} minute(s)
              {resetCountdown ? ` • Reset dans ${resetCountdown}` : ""}
            </p>
          </>
        ) : (
          <p style={{ margin: 0, opacity: 0.8 }}>
            Chargement de tes générations restantes...
          </p>
        )}
      </div>
    );
  };

  const renderHistoryTable = () => (
    <div className="history-card glass">
      <div className="history-header">
        <div>
          <p>Historique admin</p>
          <h3>Membres et générations</h3>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="secondary-button" onClick={loadHistory}>
            Rafraîchir
          </button>
          <button className="secondary-button" onClick={exportHistoryCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
          margin: "14px 0",
        }}
      >
        <input
          placeholder="Rechercher membre, service, ressource..."
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          style={{
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "14px",
            padding: "12px",
            background: "rgba(255, 255, 255, 0.06)",
            color: "white",
          }}
        />

        <select
          value={historyServiceFilter}
          onChange={(e) => setHistoryServiceFilter(e.target.value)}
        >
          <option value="Tous">Tous les services</option>
          {services.map((service) => (
            <option key={service.name} value={service.name}>
              {service.name}
            </option>
          ))}
        </select>
      </div>

      <p className="import-status">
        {filteredHistory.length} résultat(s) affiché(s) sur {history.length}.
      </p>

      {historyStatus && <p className="import-status">{historyStatus}</p>}

      {!historyStatus && filteredHistory.length === 0 && (
        <p className="history-empty">Aucune génération trouvée.</p>
      )}

      {filteredHistory.length > 0 && (
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Service</th>
                <th>Ressource générée</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.map((item) => (
                <tr key={item.id}>
                  <td>{item.username || item.user_id || "Utilisateur"}</td>
                  <td>{item.service}</td>
                  <td>
                    <code>
                      {item.resource_value || "Ancienne génération non stockée"}
                    </code>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSettingsPanel = () => (
    <div className="admin-import-box">
      <h3>Verrouillage VIP et maintenance</h3>

      <p>
        Réserve un service aux VIP ou désactive temporairement la génération.
      </p>

      <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        {services.map((service) => {
          const vipOnly = serviceSettings?.[service.name]?.vipOnly === true;
          const maintenance = serviceSettings?.[service.name]?.maintenance === true;

          return (
            <div
              key={service.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                alignItems: "center",
                gap: "12px",
                padding: "14px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.05)",
              }}
            >
              <span>
                {service.icon} {service.name}
              </span>

              <button
                onClick={() =>
                  handleUpdateServiceSettings(service.name, { vipOnly: !vipOnly })
                }
                style={{
                  border: "none",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  fontWeight: "900",
                  cursor: "pointer",
                  background: vipOnly
                    ? "rgba(255, 255, 255, 0.14)"
                    : "linear-gradient(135deg, #ffcc00, #ff8c00)",
                  color: vipOnly ? "white" : "#1a1200",
                }}
              >
                {vipOnly ? "Remettre public" : "Réserver VIP"}
              </button>

              <button
                onClick={() =>
                  handleUpdateServiceSettings(service.name, {
                    maintenance: !maintenance,
                  })
                }
                style={{
                  border: "none",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  fontWeight: "900",
                  cursor: "pointer",
                  background: maintenance
                    ? "rgba(255, 255, 255, 0.14)"
                    : "linear-gradient(135deg, #ff4d4d, #aa0000)",
                  color: "white",
                }}
              >
                {maintenance ? "Réactiver" : "Maintenance"}
              </button>
            </div>
          );
        })}
      </div>

      {vipLockStatus && <p className="import-status">{vipLockStatus}</p>}
    </div>
  );

  const renderStockPanel = () => (
    <div className="admin-import-box">
      <h3>Stocks</h3>
      <p>Surveille les services en rupture ou presque vides.</p>

      <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        {services.map((service) => {
          const stock = getStock(service.name);
          const badge = getServiceBadge(service.name);

          return (
            <div
              key={service.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                padding: "14px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.05)",
              }}
            >
              <span>
                {service.icon} {service.name}
              </span>
              <strong style={{ color: badge.color }}>
                {stock} restante(s) • {badge.label}
              </strong>
            </div>
          );
        })}
      </div>

      {stats?.lowStock?.length > 0 && (
        <p className="admin-error">
          ⚠️ Stock faible :{" "}
          {stats.lowStock
            .map((item) => `${item.service} (${item.count})`)
            .join(", ")}
        </p>
      )}
    </div>
  );

  const renderImportPanel = () => (
    <div className="admin-import-box">
      <h3>Importer des ressources</h3>

      <p>
        Colle une ressource par ligne. Exemple : <code>CODE-AAAA-1111</code>
      </p>

      <select
        value={selectedService}
        onChange={(e) => setSelectedService(e.target.value)}
      >
        {services.map((service) => (
          <option key={service.name} value={service.name}>
            {service.name}
          </option>
        ))}
      </select>

      <textarea
        placeholder={"CODE-AAAA-1111\nCODE-BBBB-2222\nCODE-CCCC-3333"}
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
      ></textarea>

      <button className="generate-button" onClick={handleImport}>
        Importer
      </button>

      {importStatus && <p className="import-status">{importStatus}</p>}
    </div>
  );

  const planCardStyle = {
    padding: "28px",
    borderRadius: "26px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  };

  const planBadgeStyle = {
    width: "fit-content",
    padding: "8px 14px",
    borderRadius: "999px",
    fontWeight: "900",
    border: "1px solid rgba(255, 255, 255, 0.14)",
  };

  const planListStyle = {
    listStyle: "none",
    padding: 0,
    margin: "10px 0 18px",
    display: "grid",
    gap: "10px",
  };

  const planLiStyle = {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "rgba(255, 255, 255, 0.88)",
  };

  const adminTabs = [
    { key: "import", label: "Importer" },
    { key: "settings", label: "VIP / Maintenance" },
    { key: "stocks", label: "Stocks" },
    { key: "history", label: "Historique" },
  ];

  const premiumPanelStyle = {
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(255, 0, 0, 0.16)",
    boxShadow: "0 0 35px rgba(255, 0, 0, 0.12)",
  };

  const premiumGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginTop: "24px",
  };

  const floatingSupportStyle = {
    position: "fixed",
    right: "22px",
    bottom: "22px",
    zIndex: 50,
    border: "1px solid rgba(255, 255, 255, 0.16)",
    borderRadius: "999px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, rgba(255, 0, 0, 0.9), rgba(90, 0, 0, 0.95))",
    color: "white",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 28px rgba(255, 0, 0, 0.38)",
  };

  const premiumInfoCardStyle = {
    ...planCardStyle,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))",
  };

  return (
    <div className="app">
      <div className="background-glow"></div>

      <div className="particles">
        {Array.from({ length: 35 }).map((_, index) => (
          <span key={index}></span>
        ))}
      </div>

      <header className="navbar">
        <div className="logo">
          <img src="/logo.png" alt="ToolsOP V2 Logo" className="site-logo" />

          <div>
            <h2>ToolsOP</h2>
            <p>V2 GEN</p>
          </div>
        </div>

        <nav>
          <a href="#home">Accueil</a>
          <a href="#services">Services</a>
          <a href="#popular">Populaires</a>
          <a href="#vip">Offres</a>
          <a href="#support">Support</a>
          <a href="#rules">Règlement</a>
          <a href="#stats">Stats</a>
          <button onClick={handleAdminAccess}>Admin</button>
        </nav>

        <button className="nav-button" onClick={handleDiscordLogin}>
          {loggedIn ? `Connecté : ${user?.username}` : "Connexion Discord"}
        </button>
      </header>

      <main className="hero" id="home">
        <section className="hero-card glass" style={premiumPanelStyle}>
          <div className="badge">
            <span></span>
            Nouvelle génération
          </div>

          <h1>
            ToolsOP <span>V2 Gen</span>
          </h1>

          <p className="subtitle">
            Plateforme moderne, rapide et sécurisée pour gérer tes ressources.
          </p>

          <div className="hero-tags">
            <div>⚡ Rapide</div>
            <div>🛡️ Sécurisé</div>
            <div>📱 Mobile</div>
            <div>👑 Premium</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginTop: "18px",
            }}
          >
            <div style={planLiStyle}>🔥 Services populaires</div>
            <div style={planLiStyle}>🎫 Support Discord</div>
            <div style={planLiStyle}>✨ Interface premium</div>
          </div>

          <div className="hero-actions">
            <button className="primary-button" onClick={handleDiscordLogin}>
              {loggedIn ? "Discord connecté" : "Connexion Discord"}
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                document.getElementById("services")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
            >
              Voir les services
            </button>

            <button className="secondary-button" onClick={handleOpenSupport}>
              Support Discord
            </button>
          </div>

          {cooldownRemaining > 0 && (
            <p className="admin-error">
              Prochaine génération disponible dans {formatCooldown(cooldownRemaining)}
            </p>
          )}

          {accessError && <p className="admin-error">{accessError}</p>}

          {renderAccountCard()}
        </section>
      </main>

      <section className="stats glass" id="stats">
        <div>
          <strong>{stats?.totalAvailable ?? 0}</strong>
          <span>Ressources</span>
        </div>

        <div>
          <strong>{services.length}</strong>
          <span>Services</span>
        </div>

        <div>
          <strong>{stats?.totalGeneratedToday ?? 0}</strong>
          <span>Générées aujourd’hui</span>
        </div>

        <div>
          <strong>{usageInfo?.plan || "24/7"}</strong>
          <span>{loggedIn ? "Ton accès" : "Disponible"}</span>
        </div>
      </section>

      <section className="services-section" id="popular">
        <div className="section-title">
          <p>Services populaires</p>
          <h2>Les plus utilisés par la communauté</h2>
        </div>

        <div style={premiumGridStyle}>
          {popularServices.map((item, index) => {
            const stock = getStock(item.service);
            const badge = getServiceBadge(item.service);

            return (
              <div
                className="glass"
                key={item.service}
                style={{
                  ...premiumInfoCardStyle,
                  boxShadow:
                    index === 0
                      ? "0 0 34px rgba(255, 204, 0, 0.16)"
                      : "0 0 24px rgba(255, 0, 0, 0.08)",
                }}
              >
                <div style={planBadgeStyle}>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} Top {index + 1}
                </div>

                <h3 style={{ fontSize: "28px", margin: 0 }}>
                  {item.icon} {item.service}
                </h3>

                <p style={{ margin: 0, opacity: 0.78 }}>
                  {item.count > 0
                    ? `${item.count} génération(s) enregistrée(s)`
                    : "Service mis en avant selon le stock disponible"}
                </p>

                <strong style={{ color: badge.color }}>
                  {stock} restante(s) • {badge.label}
                </strong>

                <button
                  className="generate-button"
                  onClick={() => handleGenerate(item.service)}
                  disabled={stock <= 0 || serviceSettings?.[item.service]?.maintenance === true}
                >
                  Générer {item.service}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="services-section" id="services">
        <div className="section-title">
          <p>Services disponibles</p>
          <h2>Choisis une catégorie</h2>
        </div>

        <div className="services-grid">
          {services.map((service) => {
            const settings = serviceSettings?.[service.name] || {};
            const vipOnly = settings.vipOnly === true;
            const maintenance = settings.maintenance === true;
            const userIsVip = user?.isVip === true;
            const lockedForUser = vipOnly && !userIsVip;
            const stock = getStock(service.name);
            const outOfStock = stock <= 0;
            const badge = getServiceBadge(service.name);

            return (
              <div
                className="service-card glass"
                key={service.name}
                style={{
                  border: `1px solid ${badge.color}33`,
                  boxShadow: `0 0 24px ${badge.color}18`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div className="service-top">
                  <div className="service-icon">{service.icon}</div>
                  <span style={{ color: badge.color }}>{badge.label}</span>
                </div>

                <h3>{service.name}</h3>
                <p>{stock} ressource(s) disponible(s)</p>

                {vipOnly && (
                  <p
                    style={{
                      color: "#ffcc00",
                      fontWeight: "800",
                      marginTop: "8px",
                    }}
                  >
                    👑 Service réservé aux membres VIP
                  </p>
                )}

                {maintenance && (
                  <p
                    style={{
                      color: "#ff6b6b",
                      fontWeight: "800",
                      marginTop: "8px",
                    }}
                  >
                    🛠️ Maintenance temporaire
                  </p>
                )}

                <button
                  className="generate-button"
                  disabled={
                    cooldownRemaining > 0 ||
                    lockedForUser ||
                    maintenance ||
                    outOfStock
                  }
                  onClick={() => handleGenerate(service.name)}
                  style={
                    vipOnly
                      ? {
                          background:
                            "linear-gradient(135deg, #ffcc00, #ff8c00)",
                          color: "#1a1200",
                          boxShadow: "0 0 18px rgba(255, 196, 0, 0.35)",
                          cursor:
                            lockedForUser || maintenance || outOfStock
                              ? "not-allowed"
                              : "pointer",
                        }
                      : undefined
                  }
                >
                  {maintenance
                    ? "Maintenance"
                    : outOfStock
                    ? "Rupture de stock"
                    : lockedForUser
                    ? "Uniquement membre VIP"
                    : cooldownRemaining > 0
                    ? `Patiente ${formatCooldown(cooldownRemaining)}`
                    : vipOnly
                    ? "Générer VIP"
                    : "Générer"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="vip-section" id="vip">
        <div className="section-title">
          <p>Offres et avantages</p>
          <h2>Choisis ton accès ToolsOP</h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "22px",
            marginTop: "28px",
          }}
        >
          <div className="glass" style={planCardStyle}>
            <div
              style={{
                ...planBadgeStyle,
                background: "rgba(255, 255, 255, 0.08)",
                color: "white",
              }}
            >
              🆓 Gratuit
            </div>

            <h3 style={{ fontSize: "28px", margin: "0" }}>Accès gratuit</h3>

            <div style={{ fontSize: "36px", fontWeight: "900", color: "white" }}>
              0€ <span style={{ fontSize: "15px", opacity: 0.6 }}>/ jour</span>
            </div>

            <p style={{ color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.6 }}>
              Pour utiliser le générateur gratuitement avec une limite simple.
            </p>

            <ul style={planListStyle}>
              <li style={planLiStyle}>✅ 6 générations par jour</li>
              <li style={planLiStyle}>⏱️ Cooldown de 5 minutes</li>
              <li style={planLiStyle}>🎁 Accès aux services publics</li>
              <li style={planLiStyle}>📦 Stocks selon disponibilité</li>
            </ul>

            <button className="secondary-button" onClick={handleDiscordLogin}>
              Commencer gratuitement
            </button>
          </div>

          <div
            className="glass"
            style={{
              ...planCardStyle,
              border: "1px solid rgba(255, 140, 0, 0.24)",
              boxShadow: "0 0 28px rgba(255, 140, 0, 0.1)",
            }}
          >
            <div
              style={{
                ...planBadgeStyle,
                background: "rgba(255, 140, 0, 0.14)",
                color: "#ffb347",
                borderColor: "rgba(255, 140, 0, 0.35)",
              }}
            >
              🚀 Boost
            </div>

            <h3 style={{ fontSize: "28px", margin: "0" }}>Accès Boost</h3>

            <div style={{ fontSize: "36px", fontWeight: "900", color: "#ffb347" }}>
              Boost <span style={{ fontSize: "15px", opacity: 0.7 }}>Discord</span>
            </div>

            <p style={{ color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.6 }}>
              Pour les membres qui boostent le serveur et veulent plus de générations.
            </p>

            <ul style={planListStyle}>
              <li style={planLiStyle}>✅ 15 générations par jour</li>
              <li style={planLiStyle}>⏱️ Cooldown de 2 minutes</li>
              <li style={planLiStyle}>🚀 Avantage membre boost</li>
              <li style={planLiStyle}>📦 Plus de confort d’utilisation</li>
            </ul>

            <button className="secondary-button" onClick={handleDiscordLogin}>
              Se connecter avec Discord
            </button>
          </div>

          <div
            className="glass"
            style={{
              ...planCardStyle,
              border: "1px solid rgba(255, 204, 0, 0.3)",
              boxShadow: "0 0 34px rgba(255, 204, 0, 0.14)",
            }}
          >
            <div
              style={{
                ...planBadgeStyle,
                background: "rgba(255, 204, 0, 0.14)",
                color: "#ffcc00",
                borderColor: "rgba(255, 204, 0, 0.4)",
              }}
            >
              👑 VIP
            </div>

            <h3 style={{ fontSize: "28px", margin: "0" }}>VIP à vie</h3>

            <div
              style={{
                fontSize: "36px",
                fontWeight: "900",
                color: "#ffcc00",
                textShadow: "0 0 20px rgba(255, 204, 0, 0.35)",
              }}
            >
              3€ <span style={{ fontSize: "15px", opacity: 0.75 }}>à vie</span>
            </div>

            <p style={{ color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.6 }}>
              L’offre premium pour profiter au maximum du générateur ToolsOP V2.
            </p>

            <ul style={planListStyle}>
              <li style={planLiStyle}>♾️ Générations illimitées par jour</li>
              <li style={planLiStyle}>⏱️ Cooldown réduit à 1 minute</li>
              <li style={planLiStyle}>👑 Accès aux services VIP uniquement</li>
              <li style={planLiStyle}>🚀 Accès premium</li>
              <li style={planLiStyle}>🛠️ Support plus rapide</li>
            </ul>

            <button className="primary-button" onClick={handleDiscordLogin}>
              Devenir VIP
            </button>
          </div>
        </div>
      </section>

      <section className="vip-section" id="support">
        <div className="section-title">
          <p>Support</p>
          <h2>Besoin d’aide ?</h2>
        </div>

        <div style={premiumGridStyle}>
          <div className="glass" style={premiumInfoCardStyle}>
            <div style={{ ...planBadgeStyle, color: "#ffcc00" }}>🎫 Ticket Discord</div>
            <h3 style={{ fontSize: "28px", margin: 0 }}>Support rapide</h3>
            <p style={{ color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.6 }}>
              En cas de problème avec une génération, ouvre un ticket sur le Discord.
              Pense à indiquer ton pseudo, le service et l’heure de génération.
            </p>
            <button className="primary-button" onClick={handleOpenSupport}>
              Ouvrir un ticket
            </button>
          </div>

          <div className="glass" style={premiumInfoCardStyle}>
            <div style={{ ...planBadgeStyle, color: "#ff6b6b" }}>🛠️ Aide</div>
            <h3 style={{ fontSize: "28px", margin: 0 }}>Avant de contacter</h3>
            <ul style={planListStyle}>
              <li style={planLiStyle}>Vérifie ton stock et ton cooldown.</li>
              <li style={planLiStyle}>Vérifie si le service est en maintenance.</li>
              <li style={planLiStyle}>Ajoute une capture du message d’erreur.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="vip-section" id="rules">
        <div className="section-title">
          <p>Règlement</p>
          <h2>Utilisation responsable</h2>
        </div>

        <div className="glass" style={{ ...planCardStyle, marginTop: "24px" }}>
          <ul style={planListStyle}>
            <li style={planLiStyle}>
              ✅ Utilise uniquement des ressources, codes ou licences que tu as le droit de distribuer.
            </li>
            <li style={planLiStyle}>
              🚫 Le partage d’accès volés, piratés ou obtenus illégalement est interdit.
            </li>
            <li style={planLiStyle}>
              🛠️ Certains services peuvent être mis en maintenance temporairement.
            </li>
            <li style={planLiStyle}>
              📩 En cas de problème, contacte le support du serveur Discord.
            </li>
          </ul>
        </div>
      </section>

      {resultOpen && generatedResource && (
        <div className="result-overlay">
          <div className="result-page glass">
            <button
              className="result-close"
              onClick={() => setResultOpen(false)}
            >
              ×
            </button>

            <div className="result-icon">🎁</div>

            <p className="result-label">Ressource générée avec succès</p>

            <h2>Voici ton code</h2>

            <div className="result-code">{generatedResource}</div>

            {lastDailyInfo && (
              <p className="import-status">
                {lastDailyInfo.dailyLimit === null
                  ? "VIP : générations illimitées aujourd’hui."
                  : `Aujourd’hui : ${lastDailyInfo.dailyUsed}/${lastDailyInfo.dailyLimit} génération(s), ${lastDailyInfo.dailyRemaining} restante(s).`}
              </p>
            )}

            <div className="result-actions">
              <button className="primary-button" onClick={handleCopy}>
                Copier le code
              </button>

              <button
                className="secondary-button"
                onClick={() => setResultOpen(false)}
              >
                Retour au site
              </button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div className="admin-overlay">
          <div className="admin-panel glass">
            <button className="admin-close" onClick={() => setAdminOpen(false)}>
              ×
            </button>

            <div className="admin-dashboard">
              <div className="admin-header">
                <div>
                  <p>Panneau administrateur</p>
                  <h2>Dashboard ToolsOP</h2>
                </div>

                <button
                  className="logout-button"
                  onClick={() => setAdminOpen(false)}
                >
                  Fermer
                </button>
              </div>

              <div className="admin-stats-grid">
                <div>
                  <strong>{stats?.totalAvailable ?? 0}</strong>
                  <span>Ressources restantes</span>
                </div>

                <div>
                  <strong>{stats?.totalGeneratedToday ?? 0}</strong>
                  <span>Distribuées aujourd’hui</span>
                </div>

                <div>
                  <strong>{services.length}</strong>
                  <span>Services actifs</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  margin: "18px 0",
                }}
              >
                {adminTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={adminTab === tab.key ? "primary-button" : "secondary-button"}
                    onClick={() => setAdminTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {adminTab === "import" && renderImportPanel()}
              {adminTab === "settings" && renderSettingsPanel()}
              {adminTab === "stocks" && renderStockPanel()}
              {adminTab === "history" && renderHistoryTable()}
            </div>
          </div>
        </div>
      )}

      <button style={floatingSupportStyle} onClick={handleOpenSupport}>
        🎫 Support
      </button>
    </div>
  );
}

export default App;