import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  const [serviceSettings, setServiceSettings] = useState({});
  const [vipLockStatus, setVipLockStatus] = useState("");
  const [lastDailyInfo, setLastDailyInfo] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);

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

  const handleDiscordLogin = () => {
    window.location.href = `${API_URL}/auth/discord`;
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

  const handleToggleVipService = async (serviceName, vipOnly) => {
    try {
      setVipLockStatus("Modification en cours...");

      const response = await fetch(`${API_URL}/api/service-settings/${serviceName}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vipOnly,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVipLockStatus(data.error || "Erreur pendant la modification VIP.");
        return;
      }

      setServiceSettings((previous) => ({
        ...previous,
        [serviceName]: {
          vipOnly,
        },
      }));

      setVipLockStatus(
        vipOnly
          ? `${serviceName} est maintenant réservé aux VIP.`
          : `${serviceName} est maintenant disponible pour tous.`
      );

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
    const userIsVip = user?.isVip === true;

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
          setUsageInfo({
            success: true,
            plan:
              data.dailyLimit === null
                ? "VIP"
                : data.dailyLimit === 15
                ? "Boost"
                : "Gratuit",
            dailyLimit: data.dailyLimit,
            dailyUsed: data.dailyUsed || 0,
            dailyRemaining: data.dailyRemaining || 0,
            cooldownMs: data.cooldownMs || null,
            unlimited: data.dailyLimit === null,
          });
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
      });

      setUsageInfo((previous) => ({
        ...(previous || {}),
        success: true,
        plan:
          data.dailyLimit === null
            ? "VIP"
            : data.dailyLimit === 15
            ? "Boost"
            : "Gratuit",
        dailyLimit: data.dailyLimit,
        dailyUsed: data.dailyUsed,
        dailyRemaining: data.dailyRemaining,
        cooldownMs: data.cooldownMs,
        unlimited: data.dailyLimit === null,
      }));

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

  const renderHistoryTable = () => (
    <div className="history-card glass">
      <div className="history-header">
        <div>
          <p>Historique admin</p>
          <h3>Membres et générations</h3>
        </div>

        <button className="secondary-button" onClick={loadHistory}>
          Rafraîchir
        </button>
      </div>

      {historyStatus && <p className="import-status">{historyStatus}</p>}

      {!historyStatus && history.length === 0 && (
        <p className="history-empty">Aucune génération pour le moment.</p>
      )}

      {history.length > 0 && (
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
              {history.map((item) => (
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

  const renderVipLockPanel = () => (
    <div className="admin-import-box">
      <h3>Verrouillage VIP</h3>

      <p>
        Choisis quels services sont réservés uniquement aux membres VIP.
      </p>

      <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        {services.map((service) => {
          const vipOnly = serviceSettings?.[service.name]?.vipOnly === true;

          return (
            <div
              key={service.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
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
                onClick={() => handleToggleVipService(service.name, !vipOnly)}
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
                {vipOnly ? "Remettre pour tous" : "Réserver VIP"}
              </button>
            </div>
          );
        })}
      </div>

      {vipLockStatus && <p className="import-status">{vipLockStatus}</p>}
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
          <a href="#vip">Offres</a>
          <a href="#stats">Stats</a>
          <button onClick={handleAdminAccess}>Admin</button>
        </nav>

        <button className="nav-button" onClick={handleDiscordLogin}>
          {loggedIn ? `Connecté : ${user?.username}` : "Connexion Discord"}
        </button>
      </header>

      <main className="hero" id="home">
        <section className="hero-card glass">
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
          </div>

          {cooldownRemaining > 0 && (
            <p className="admin-error">
              Prochaine génération disponible dans{" "}
              {formatCooldown(cooldownRemaining)}
            </p>
          )}

          {accessError && <p className="admin-error">{accessError}</p>}

          {loggedIn && usageInfo && (
            <div
              className="glass"
              style={{
                marginTop: "18px",
                padding: "18px",
                borderRadius: "20px",
                display: "grid",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <strong style={{ fontSize: "18px" }}>
                Ton accès : {usageInfo.plan}
              </strong>

              {usageInfo.unlimited ? (
                <p style={{ margin: 0, color: "#ffcc00", fontWeight: "800" }}>
                  ♾️ Générations illimitées aujourd’hui
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  Générations aujourd’hui :{" "}
                  <strong>
                    {usageInfo.dailyUsed}/{usageInfo.dailyLimit}
                  </strong>{" "}
                  — Il t’en reste <strong>{usageInfo.dailyRemaining}</strong>
                </p>
              )}

              <p style={{ margin: 0, opacity: 0.8 }}>
                Cooldown :{" "}
                {usageInfo.cooldownMs
                  ? Math.round(usageInfo.cooldownMs / 60000)
                  : "?"}{" "}
                minute(s)
              </p>
            </div>
          )}
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
          <strong>24/7</strong>
          <span>Disponible</span>
        </div>
      </section>

      <section className="services-section" id="services">
        <div className="section-title">
          <p>Services disponibles</p>
          <h2>Choisis une catégorie</h2>
        </div>

        <div className="services-grid">
          {services.map((service) => {
            const vipOnly = serviceSettings?.[service.name]?.vipOnly === true;
            const userIsVip = user?.isVip === true;
            const lockedForUser = vipOnly && !userIsVip;

            return (
              <div className="service-card glass" key={service.name}>
                <div className="service-top">
                  <div className="service-icon">{service.icon}</div>
                  <span>
                    {vipOnly ? "VIP uniquement" : service.status}
                  </span>
                </div>

                <h3>{service.name}</h3>
                <p>{getStock(service.name)} ressource(s) disponible(s)</p>

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

                <button
                  className="generate-button"
                  disabled={cooldownRemaining > 0 || lockedForUser}
                  onClick={() => handleGenerate(service.name)}
                  style={
                    vipOnly
                      ? {
                          background:
                            "linear-gradient(135deg, #ffcc00, #ff8c00)",
                          color: "#1a1200",
                          boxShadow: "0 0 18px rgba(255, 196, 0, 0.35)",
                          cursor: lockedForUser ? "not-allowed" : "pointer",
                        }
                      : undefined
                  }
                >
                  {lockedForUser
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
              Pour les membres qui boostent le serveur et veulent plus de
              générations.
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

              {renderVipLockPanel()}

              <div className="admin-import-box">
                <h3>Importer des ressources</h3>

                <p>
                  Colle une ressource par ligne. Exemple :{" "}
                  <code>CODE-AAAA-1111</code>
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

              {renderHistoryTable()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
