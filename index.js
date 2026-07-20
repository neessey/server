const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const cron = require("node-cron");
require("dotenv").config();

// ------------------------------------------------------------
// Vérification de la variable d'environnement
// ------------------------------------------------------------
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT est introuvable !");
  console.error(
    "Ajoutez cette variable dans Render > Environment puis redeployez."
  );
  process.exit(1);
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide.");
  console.error(err);
  process.exit(1);
}

// ------------------------------------------------------------
// Initialisation Firebase Admin
// ------------------------------------------------------------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log("✅ Firebase Admin initialisé.");

const app = express();

app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// Enregistrer un token FCM
// ------------------------------------------------------------
app.post("/api/register-token", async (req, res) => {
  const { uid, token, topics } = req.body;

  if (!token || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({
      error: "token et topics sont requis.",
    });
  }

  try {
    for (const topic of topics) {
      await admin.messaging().subscribeToTopic(token, topic);
    }

    console.log(
      `✅ Token ${uid || "inconnu"} abonné : ${topics.join(", ")}`
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Erreur abonnement.",
    });
  }
});

// ------------------------------------------------------------
// Envoyer une notification
// ------------------------------------------------------------
app.post("/api/send-notification", async (req, res) => {
  const { title, body, topic } = req.body;

  if (!title || !body || !topic) {
    return res.status(400).json({
      error: "title, body et topic sont requis.",
    });
  }

  try {
    const messageId = await admin.messaging().send({
      topic,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          icon: "/assets/logo.jpg",
        },
      },
    });

    console.log("✅ Notification envoyée :", messageId);

    res.json({
      success: true,
      messageId,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Erreur envoi notification.",
    });
  }
});

// ------------------------------------------------------------
// Fonction rappel automatique
// ------------------------------------------------------------
async function sendReminder(title, body, topic = "all-members") {
  try {
    const id = await admin.messaging().send({
      topic,
      notification: {
        title,
        body,
      },
    });

    console.log("✅ Rappel envoyé :", id);
  } catch (err) {
    console.error(err);
  }
}

// Mercredi
cron.schedule("30 17 * * 3", () => {
  sendReminder(
    "Culte d'enseignement dans 1h",
    "Rendez-vous à 18h30 à l'Auditorium Central."
  );
});

// Vendredi
cron.schedule("0 21 * * 5", () => {
  sendReminder(
    "Grande veillée dans 1h",
    "Début à 22h00 jusqu'à 02h00."
  );
});

// Dimanche
cron.schedule("0 7 * * 0", () => {
  sendReminder(
    "Culte du dimanche dans 1h",
    "Le culte débute à 08h00."
  );
});

// Lundi
cron.schedule("0 9 * * 1", () => {
  sendReminder(
    "Bilan hebdomadaire",
    "Consultez les activités de la semaine."
  );
});

// ------------------------------------------------------------
// Route de test
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    status: "Serveur Christ Army opérationnel",
  });
});

// ------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});