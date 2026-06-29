import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const services = [
  { icon: "🎮", name: "Steam", status: "Disponible" },
  { icon: "🎬", name: "Disney", status: "Disponible" },
  { icon: "📺", name: "Netflix", status: "Disponible" },
  { icon: "🎯", name: "Fortnite", status: "Disponible" },
  { icon: "🟢", name: "Xbox", status: "Disponible" },
  { icon: "✉️", name: "Hotmail", status: "Disponible" },
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

  const loadStats = () => {
    fetch(`${API_URL}/api/stats`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
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
      })
      .catch(() => {
        setLoggedIn(false);
        setUser(null);
      });

    loadStats();
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
    } catch (error) {
      console.error(error);
      setImportStatus("Impossible de contacter le serveur.");
    }
  };

  const handleGenerate = async (serviceName) => {
    if (!loggedIn) {
      handleDiscordLogin();
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

        alert(data.error || "Erreur pendant la génération.");
        return;
      }

      setGeneratedResource(`${data.service} : ${data.resource}`);
      setResultOpen(true);

      const cooldownMs = data.cooldownMs || 5 * 60 * 1000;
      setCooldownUntil(Date.now() + cooldownMs);

      loadStats();
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
          <a href="#vip">VIP</a>
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
          {services.map((service) => (
            <div className="service-card glass" key={service.name}>
              <div className="service-top">
                <div className="service-icon">{service.icon}</div>
                <span>{service.status}</span>
              </div>

              <h3>{service.name}</h3>
              <p>{getStock(service.name)} ressource(s) disponible(s)</p>

              <button
                className="generate-button"
                disabled={cooldownRemaining > 0}
                onClick={() => handleGenerate(service.name)}
              >
                {cooldownRemaining > 0
                  ? `Patiente ${formatCooldown(cooldownRemaining)}`
                  : "Générer"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="vip-section" id="vip">
        <div className="section-title">
          <p>Offre premium</p>
          <h2>VIP ToolsOP</h2>
        </div>

        <div className="vip-grid">
          <div className="vip-card glass">
            <div className="vip-badge">👑 VIP</div>

            <h3>VIP à vie</h3>

            <div className="vip-price">
              3€ <span>à vie</span>
            </div>

            <p>
              Le VIP permet d’avoir une meilleure expérience sur le générateur
              ToolsOP V2.
            </p>

            <ul>
              <li>⚡ Cooldown réduit</li>
              <li>👑 Rôle VIP Discord</li>
              <li>🚀 Accès premium</li>
              <li>🛠️ Support plus rapide</li>
            </ul>

            <button className="primary-button" onClick={handleDiscordLogin}>
              Rejoindre avec Discord
            </button>
          </div>

          {loggedIn && user?.isAdmin === true && renderHistoryTable()}
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

export default App;