const express = require("express");
const cors = require("cors");
const session = require("express-session");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://toolsopv2gen.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      console.log("CORS bloqué pour :", origin);
      return callback(new Error(`CORS bloqué pour : ${origin}`));
    },
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "temporary-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

const allowedServices = [
  "Steam",
  "Disney",
  "Netflix",
  "Fortnite",
  "Xbox",
  "Hotmail",
  "Deezer",
  "Nitro Uncheck",
];

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const VIP_COOLDOWN_MS = 1 * 60 * 1000;
const BOOST_COOLDOWN_MS = 2 * 60 * 1000;

function getCooldownForUser(user) {
  const roles = user?.roles || [];

  if (roles.includes(process.env.DISCORD_VIP_ROLE_ID)) {
    return VIP_COOLDOWN_MS;
  }

  if (roles.includes(process.env.DISCORD_BOOST_ROLE_ID)) {
    return BOOST_COOLDOWN_MS;
  }

  return DEFAULT_COOLDOWN_MS;
}

function getDailyLimitForUser(user) {
  const roles = user?.roles || [];

  // Premium / VIP = illimité
  if (roles.includes(process.env.DISCORD_VIP_ROLE_ID)) {
    return null;
  }

  // Boost = 15 générations par jour
  if (roles.includes(process.env.DISCORD_BOOST_ROLE_ID)) {
    return 15;
  }

  // Sans abonnement = 6 générations par jour
  return 6;
}

function isVipUser(user) {
  const roles = user?.roles || [];
  return roles.includes(process.env.DISCORD_VIP_ROLE_ID);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Tu dois être connecté avec Discord.",
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Tu dois être connecté avec Discord.",
    });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({
      error: "Accès refusé : rôle admin requis.",
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.send("Backend ToolsOP V2 Gen en ligne avec Supabase.");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend en ligne.",
    clientUrl: process.env.CLIENT_URL || null,
  });
});

app.get("/auth/discord", (req, res) => {
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}?error=no_code`);
    }

    if (!state || state !== req.session.oauthState) {
      return res.redirect(`${process.env.CLIENT_URL}?error=invalid_state`);
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Erreur token Discord :", tokenData);
      return res.redirect(`${process.env.CLIENT_URL}?error=token_error`);
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Erreur utilisateur Discord :", user);
      return res.redirect(`${process.env.CLIENT_URL}?error=user_error`);
    }

    const memberResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!memberResponse.ok) {
      return res.redirect(`${process.env.CLIENT_URL}?error=not_in_server`);
    }

    const member = await memberResponse.json();

    const roles = member.roles || [];
    const isAdmin = roles.includes(process.env.DISCORD_ADMIN_ROLE_ID);
    const isVip = roles.includes(process.env.DISCORD_VIP_ROLE_ID);
    const isBoost = roles.includes(process.env.DISCORD_BOOST_ROLE_ID);

    req.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      roles,
      isAdmin,
      isVip,
      isBoost,
    };

    return res.redirect(process.env.CLIENT_URL);
  } catch (error) {
    console.error("Erreur serveur :", error);
    return res.redirect(`${process.env.CLIENT_URL}?error=server_error`);
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({
      loggedIn: false,
      user: null,
    });
  }

  return res.json({
    loggedIn: true,
    user: req.session.user,
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/stats", async (req, res) => {
  try {
    const { data: availableResources, error: resourcesError } = await supabase
      .from("resources")
      .select("service")
      .eq("used", false);

    if (resourcesError) {
      console.error(resourcesError);
      return res.status(500).json({ error: "Erreur lecture ressources." });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayHistory, error: historyError } = await supabase
      .from("history")
      .select("id")
      .gte("created_at", todayStart.toISOString());

    if (historyError) {
      console.error(historyError);
      return res.status(500).json({ error: "Erreur lecture historique." });
    }

    const byService = {};

    for (const service of allowedServices) {
      byService[service] = availableResources.filter(
        (item) => item.service === service
      ).length;
    }

    res.json({
      totalAvailable: availableResources.length,
      totalGeneratedToday: todayHistory.length,
      totalServices: allowedServices.length,
      byService,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur stats." });
  }
});

app.get("/api/service-settings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("service_settings")
      .select("service, vip_only");

    if (error) {
      console.error("Erreur lecture service settings :", error);
      return res.status(500).json({
        error: "Erreur lecture paramètres services.",
      });
    }

    const settings = {};

    for (const service of allowedServices) {
      settings[service] = {
        vipOnly: false,
      };
    }

    for (const item of data || []) {
      settings[item.service] = {
        vipOnly: item.vip_only === true,
      };
    }

    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Erreur serveur service settings :", error);
    res.status(500).json({
      error: "Erreur serveur paramètres services.",
    });
  }
});

app.patch("/api/service-settings/:service", requireAdmin, async (req, res) => {
  try {
    const { service } = req.params;
    const { vipOnly } = req.body;

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        error: "Service invalide.",
      });
    }

    const { error } = await supabase.from("service_settings").upsert({
      service,
      vip_only: vipOnly === true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Erreur mise à jour service settings :", error);
      return res.status(500).json({
        error: "Erreur mise à jour service.",
      });
    }

    res.json({
      success: true,
      service,
      vipOnly: vipOnly === true,
    });
  } catch (error) {
    console.error("Erreur serveur service settings :", error);
    res.status(500).json({
      error: "Erreur serveur service settings.",
    });
  }
});

app.post("/api/resources/import", requireAdmin, async (req, res) => {
  try {
    const { service, items } = req.body;

    if (!allowedServices.includes(service)) {
      return res.status(400).json({ error: "Service invalide." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Aucune ressource à importer.",
      });
    }

    const cleanItems = items
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 500);

    const newResources = cleanItems.map((value) => ({
      service,
      value,
      used: false,
    }));

    const { error } = await supabase.from("resources").insert(newResources);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: "Erreur pendant l'import Supabase.",
      });
    }

    res.json({
      success: true,
      added: newResources.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur import." });
  }
});

app.post("/api/generate", requireLogin, async (req, res) => {
  try {
    const { service } = req.body;

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        error: "Service invalide.",
      });
    }

    const { data: serviceSetting, error: serviceSettingError } = await supabase
      .from("service_settings")
      .select("vip_only")
      .eq("service", service)
      .maybeSingle();

    if (serviceSettingError) {
      console.error("Erreur lecture VIP service :", serviceSettingError);
      return res.status(500).json({
        error: "Erreur vérification VIP.",
      });
    }

    if (serviceSetting?.vip_only && !isVipUser(req.session.user)) {
      return res.status(403).json({
        error: "Ce service est réservé aux membres VIP.",
        vipOnly: true,
      });
    }

    const userId = req.session.user.id;
    const cooldownMs = getCooldownForUser(req.session.user);
    const dailyLimit = getDailyLimitForUser(req.session.user);
    const now = Date.now();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: dailyCount, error: dailyCountError } = await supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if (dailyCountError) {
      console.error("Erreur limite quotidienne :", dailyCountError);
      return res.status(500).json({
        error: "Erreur vérification limite quotidienne.",
      });
    }

    if (dailyLimit !== null && (dailyCount || 0) >= dailyLimit) {
      return res.status(429).json({
        error: `Limite atteinte : tu as déjà utilisé tes ${dailyLimit} génération(s) aujourd’hui.`,
        dailyLimit,
        dailyUsed: dailyCount || 0,
        dailyRemaining: 0,
      });
    }

    const { data: cooldownData, error: cooldownError } = await supabase
      .from("cooldowns")
      .select("last_generation_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (cooldownError) {
      console.error(cooldownError);
      return res.status(500).json({
        error: "Erreur lecture cooldown.",
      });
    }

    if (cooldownData?.last_generation_at) {
      const lastGeneration = new Date(
        cooldownData.last_generation_at
      ).getTime();

      const elapsed = now - lastGeneration;
      const remaining = cooldownMs - elapsed;

      if (remaining > 0) {
        return res.status(429).json({
          error: "Tu dois attendre avant de générer à nouveau.",
          cooldownRemainingMs: remaining,
          cooldownEndsAt: now + remaining,
          cooldownMs,
          dailyLimit,
          dailyUsed: dailyLimit === null ? null : dailyCount || 0,
          dailyRemaining:
            dailyLimit === null
              ? null
              : Math.max(0, dailyLimit - (dailyCount || 0)),
        });
      }
    }

    const { data: resource, error: selectError } = await supabase
      .from("resources")
      .select("*")
      .eq("service", service)
      .eq("used", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error(selectError);
      return res.status(500).json({
        error: "Erreur lecture ressource.",
      });
    }

    if (!resource) {
      return res.status(404).json({
        error: "Aucune ressource disponible.",
      });
    }

    const { error: updateError } = await supabase
      .from("resources")
      .update({
        used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("id", resource.id);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({
        error: "Erreur mise à jour ressource.",
      });
    }

    const { error: historyError } = await supabase.from("history").insert({
      service,
      user_id: userId,
      username: req.session.user.username,
      resource_value: resource.value,
    });

    if (historyError) {
      console.error("Erreur historique génération :", historyError);
    }

    const { error: cooldownUpsertError } = await supabase
      .from("cooldowns")
      .upsert({
        user_id: userId,
        last_generation_at: new Date().toISOString(),
      });

    if (cooldownUpsertError) {
      console.error(cooldownUpsertError);
    }

    const newDailyUsed = (dailyCount || 0) + 1;

    res.json({
      success: true,
      service,
      resource: resource.value,
      cooldownMs,
      dailyLimit,
      dailyUsed: dailyLimit === null ? null : newDailyUsed,
      dailyRemaining:
        dailyLimit === null ? null : Math.max(0, dailyLimit - newDailyUsed),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur génération." });
  }
});

app.get("/api/history", requireAdmin, async (req, res) => {
  try {
    console.log("Route /api/history appelée par :", req.session.user?.username);

    const { data, error } = await supabase
      .from("history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Erreur Supabase historique :", error);
      return res.status(500).json({
        error: error.message || "Erreur lecture historique.",
      });
    }

    return res.json({
      success: true,
      history: data || [],
    });
  } catch (error) {
    console.error("Erreur serveur historique :", error);
    return res.status(500).json({
      error: error.message || "Erreur serveur historique.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});