import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Data helpers ──────────────────────────────────────────────────────────────

function readData(filename) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

function writeData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// ── Emotion analysis ──────────────────────────────────────────────────────────

const EMOTION_PATTERNS = {
  danger: {
    keywords: [
      'suicide', 'suicider', 'me tuer', 'en finir', 'plus envie de vivre',
      'veux mourir', 'veut mourir', 'me suicider', 'tuer', 'overdose',
      'sauter', 'pendaison', 'me faire du mal', 'me blesser gravement',
      'prise d\'otage', 'violence grave', 'arme'
    ],
    score: 10,
    label: 'Danger critique'
  },
  severeDepression: {
    keywords: [
      'sans espoir', 'plus d\'espoir', 'tout est fini', 'rien ne vaut',
      'à quoi bon', 'plus envie de rien', 'désespoir', 'vide total',
      'inutile de continuer', 'plus aucune raison', 'rien ne change jamais'
    ],
    score: 7,
    label: 'Dépression sévère'
  },
  depression: {
    keywords: [
      'déprimé', 'dépression', 'très triste', 'nul', 'inutile',
      'rien ne va', 'tout va mal', 'plus de motivation', 'épuisé émotionnellement',
      'vide intérieur', 'ne ressens plus rien', 'zombie'
    ],
    score: 5,
    label: 'Dépression'
  },
  isolation: {
    keywords: [
      'seul', 'solitude', 'isolé', 'personne ne me', 'abandonné',
      'rejeté', 'incompris', 'plus personne', 'personne ne comprend',
      'exclu', 'mis à l\'écart'
    ],
    score: 5,
    label: 'Isolement'
  },
  anxiety: {
    keywords: [
      'anxieux', 'anxiété', 'panique', 'angoisse', 'phobia',
      'terreur', 'attaque de panique', 'hyperventile', 'peur intense',
      'très inquiet', 'paralysé par la peur'
    ],
    score: 4,
    label: 'Anxiété'
  },
  stress: {
    keywords: [
      'stress', 'stressé', 'débordé', 'surmenage', 'burnout',
      'épuisé', 'sous pression', 'n\'en peux plus', 'à bout',
      'trop de travail', 'submergé'
    ],
    score: 3,
    label: 'Stress'
  },
  sadness: {
    keywords: [
      'triste', 'tristesse', 'pleurer', 'larmes', 'malheureux',
      'chagrin', 'peine', 'mélancolie', 'cafard', 'déprimant'
    ],
    score: 3,
    label: 'Tristesse'
  },
  anger: {
    keywords: [
      'colère', 'énervé', 'furieux', 'rage', 'agressif',
      'haineux', 'en colère', 'frustré', 'excédé', 'insupportable'
    ],
    score: 3,
    label: 'Colère'
  },
  positive: {
    keywords: [
      'bien', 'mieux', 'heureux', 'content', 'joie', 'super',
      'excellent', 'génial', 'fier', 'serein', 'calme', 'apaisé',
      'confiant', 'optimiste', 'reconnaissant', 'gratitude'
    ],
    score: -1,
    label: 'Positif'
  }
};

function analyzeEmotion(text) {
  const lower = text.toLowerCase();
  let maxScore = 0;
  let dominantEmotion = 'neutre';
  let riskScore = 0;
  const detectedEmotions = [];

  for (const [key, { keywords, score, label }] of Object.entries(EMOTION_PATTERNS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        if (!detectedEmotions.find(e => e.key === key)) {
          detectedEmotions.push({ key, label, score });
        }
        if (score > maxScore) {
          maxScore = score;
          dominantEmotion = key;
        }
        riskScore = Math.max(riskScore, Math.max(0, score));
        break;
      }
    }
  }

  let riskLevel = 1;
  if (riskScore >= 8) riskLevel = 3;
  else if (riskScore >= 4) riskLevel = 2;

  return {
    dominantEmotion,
    dominantLabel: EMOTION_PATTERNS[dominantEmotion]?.label || 'Neutre',
    detectedEmotions,
    riskScore,
    riskLevel,
    timestamp: new Date().toISOString()
  };
}

// ── Suggestions per emotion ───────────────────────────────────────────────────

const SUGGESTIONS = {
  danger: [
    { type: 'emergency', text: '3114 — Numéro national prévention suicide', icon: '🆘' },
    { type: 'emergency', text: '15 — SAMU (urgence médicale)', icon: '🚑' },
    { type: 'emergency', text: '18 — Pompiers', icon: '🔥' },
    { type: 'action', text: 'Contacter un proche de confiance maintenant', icon: '📞' }
  ],
  severeDepression: [
    { type: 'professional', text: 'Consulter un psychologue ou psychiatre', icon: '👩‍⚕️' },
    { type: 'exercise', text: 'Exercice de respiration 4-7-8', icon: '🌬️' },
    { type: 'action', text: 'Appeler quelqu\'un de proche', icon: '📞' },
    { type: 'emergency', text: '3114 si besoin d\'aide immédiate', icon: '🆘' }
  ],
  depression: [
    { type: 'exercise', text: 'Marche courte de 10 minutes en plein air', icon: '🚶' },
    { type: 'exercise', text: 'Exercice de gratitude : 3 petites choses', icon: '✨' },
    { type: 'professional', text: 'Envisager un suivi psychologique', icon: '👩‍⚕️' },
    { type: 'action', text: 'Écrire dans le journal émotionnel', icon: '📝' }
  ],
  isolation: [
    { type: 'action', text: 'Envoyer un message à quelqu\'un aujourd\'hui', icon: '💬' },
    { type: 'professional', text: 'Groupes de soutien en ligne', icon: '👥' },
    { type: 'action', text: 'Sortir, même brièvement', icon: '🌿' }
  ],
  anxiety: [
    { type: 'exercise', text: 'Respiration carrée : 4s inspir — 4s hold — 4s expir — 4s hold', icon: '🌬️' },
    { type: 'exercise', text: 'Ancrage 5-4-3-2-1 : 5 choses vues, 4 entendues…', icon: '🌟' },
    { type: 'exercise', text: 'Relaxation musculaire progressive', icon: '💆' }
  ],
  stress: [
    { type: 'exercise', text: 'Pause respiratoire de 5 minutes', icon: '🌬️' },
    { type: 'action', text: 'Lister les 3 priorités du moment', icon: '📝' },
    { type: 'exercise', text: 'Étirements doux du cou et des épaules', icon: '🤸' }
  ],
  sadness: [
    { type: 'exercise', text: 'Écrire librement ce que tu ressens', icon: '✍️' },
    { type: 'action', text: 'Contacter quelqu\'un de bienveillant', icon: '💬' },
    { type: 'exercise', text: 'Faire une activité qui te fait du bien', icon: '🎯' }
  ],
  anger: [
    { type: 'exercise', text: 'Respiration lente : 4s inspir, 8s expir', icon: '🌬️' },
    { type: 'exercise', text: 'Marche rapide pour décharger la tension', icon: '🚶' },
    { type: 'action', text: 'Écrire ce qui te met en colère sans filtre', icon: '✍️' }
  ],
  neutre: [
    { type: 'exercise', text: 'Moment de pleine conscience (3 minutes)', icon: '🧘' },
    { type: 'action', text: 'Écrire dans le journal', icon: '📝' }
  ]
};

function getSuggestions(emotion) {
  return SUGGESTIONS[emotion.dominantEmotion] || SUGGESTIONS.neutre;
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(memory) {
  const memCtx = memory && memory.length > 0
    ? `\n\nInformations mémorisées sur l'utilisateur (utilise-les subtilement pour personnaliser ton accompagnement) :\n${memory.slice(-15).map(m => `• ${m.content}`).join('\n')}`
    : '';

  return `Tu es Aria, un assistant d'accompagnement psychologique bienveillant, stable et empathique. Tu n'es pas un médecin ni un psychologue, mais un soutien quotidien précieux et un outil d'accompagnement personnel.

## Tes valeurs fondamentales
- Écoute active profonde et sans jugement
- Empathie authentique et constante
- Bienveillance et patience infinies
- Honnêteté totale sur tes limites
- Protection prioritaire de la personne

## Ce que tu fais
- Écouter et valider les émotions sans jamais les minimiser
- Proposer des exercices de respiration, relaxation, pleine conscience adaptés
- Aider à restructurer les pensées négatives (restructuration cognitive douce)
- Encourager à consulter un professionnel quand c'est approprié
- Accompagner avec patience dans la durée, en te souvenant du contexte
- Poser des questions ouvertes pour approfondir la compréhension
- Féliciter les progrès, même petits

## Ce que tu ne fais JAMAIS
- Poser des diagnostics médicaux ou psychiatriques
- Prétendre remplacer un psychologue, psychiatre ou médecin
- Encourager l'isolement social
- Créer volontairement une dépendance affective
- Donner des conseils sur les médicaments
- Culpabiliser ou juger l'utilisateur
- Manipuler émotionnellement

## En cas de danger immédiat (idées suicidaires précises, violence imminente, urgence médicale)
1. Reste calme, bienveillant et réellement présent
2. Prends la situation très au sérieux sans minimiser
3. Recommande IMMÉDIATEMENT : 3114 (numéro national prévention suicide France), 15 (SAMU), 18 (pompiers)
4. Encourage à rester en sécurité et à contacter un proche
5. Ne laisse pas la personne seule dans cette situation critique

## Style de communication
- Chaleureux, humain, jamais robotique
- Réponses concises mais profondes (2-4 paragraphes max)
- Commence souvent par reconnaître et valider l'émotion exprimée
- Adapte ton registre à l'état émotionnel : doux si la personne souffre, plus dynamique si elle va bien
- Utilise "tu" pour créer une relation de proximité bienveillante
- Évite le jargon psychologique complexe${memCtx}

Rappel fondamental : tu es un outil de soutien précieux, mais tu ne remplaces pas les soins professionnels. Encourage toujours l'aide humaine professionnelle quand c'est nécessaire, sans culpabiliser.`;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({ status: 'ok', apiConfigured: hasKey, timestamp: new Date().toISOString() });
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { message, conversationHistory = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message manquant' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Clé API Anthropic non configurée. Définissez la variable ANTHROPIC_API_KEY.'
    });
  }

  const memory = readData('memory.json') || [];
  const emotionAnalysis = analyzeEmotion(message);

  const messages = [
    ...conversationHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: buildSystemPrompt(memory),
      messages
    });

    const aiResponse = response.content[0].text;

    // Persist conversation entry
    const history = readData('history.json') || [];
    history.push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userMessage: message,
      aiResponse,
      emotion: emotionAnalysis
    });
    if (history.length > 200) history.splice(0, history.length - 200);
    writeData('history.json', history);

    // Auto-memorize significant messages
    if (message.length > 40) {
      const newMemory = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        content: message.substring(0, 250),
        emotion: emotionAnalysis.dominantEmotion,
        riskLevel: emotionAnalysis.riskLevel,
        auto: true
      };
      memory.push(newMemory);
      if (memory.length > 100) memory.splice(0, memory.length - 100);
      writeData('memory.json', memory);
    }

    const suggestions = getSuggestions(emotionAnalysis);

    res.json({
      response: aiResponse,
      emotion: emotionAnalysis,
      suggestions,
      requiresEmergency: emotionAnalysis.riskLevel >= 3
    });
  } catch (err) {
    console.error('Erreur Claude API:', err);
    res.status(500).json({ error: 'Erreur lors de la communication avec l\'IA', details: err.message });
  }
});

// GET /api/history
app.get('/api/history', (req, res) => {
  res.json(readData('history.json') || []);
});

// DELETE /api/history
app.delete('/api/history', (req, res) => {
  writeData('history.json', []);
  res.json({ success: true });
});

// GET /api/memory
app.get('/api/memory', (req, res) => {
  res.json(readData('memory.json') || []);
});

// POST /api/memory
app.post('/api/memory', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu manquant' });

  const memory = readData('memory.json') || [];
  memory.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    content: content.trim(),
    manual: true
  });
  writeData('memory.json', memory);
  res.json({ success: true });
});

// DELETE /api/memory/:id
app.delete('/api/memory/:id', (req, res) => {
  let memory = readData('memory.json') || [];
  memory = memory.filter(m => m.id !== parseInt(req.params.id));
  writeData('memory.json', memory);
  res.json({ success: true });
});

// DELETE /api/memory
app.delete('/api/memory', (req, res) => {
  writeData('memory.json', []);
  res.json({ success: true });
});

// GET /api/contacts
app.get('/api/contacts', (req, res) => {
  res.json(readData('contacts.json') || []);
});

// POST /api/contacts
app.post('/api/contacts', (req, res) => {
  const { name, phone, relation, isEmergency } = req.body;
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Nom et téléphone requis' });
  }

  const contacts = readData('contacts.json') || [];
  contacts.push({
    id: Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    relation: relation || 'Autre',
    isEmergency: !!isEmergency,
    createdAt: new Date().toISOString()
  });
  writeData('contacts.json', contacts);
  res.json({ success: true });
});

// DELETE /api/contacts/:id
app.delete('/api/contacts/:id', (req, res) => {
  let contacts = readData('contacts.json') || [];
  contacts = contacts.filter(c => c.id !== parseInt(req.params.id));
  writeData('contacts.json', contacts);
  res.json({ success: true });
});

// GET /api/journal
app.get('/api/journal', (req, res) => {
  res.json(readData('journal.json') || []);
});

// POST /api/journal
app.post('/api/journal', (req, res) => {
  const { content, emotion, mood } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' });

  const journal = readData('journal.json') || [];
  journal.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    content: content.trim(),
    emotion: emotion || 'neutre',
    mood: Math.min(10, Math.max(1, parseInt(mood) || 5))
  });
  writeData('journal.json', journal);
  res.json({ success: true });
});

// DELETE /api/journal/:id
app.delete('/api/journal/:id', (req, res) => {
  let journal = readData('journal.json') || [];
  journal = journal.filter(j => j.id !== parseInt(req.params.id));
  writeData('journal.json', journal);
  res.json({ success: true });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  const history = readData('history.json') || [];
  const journal = readData('journal.json') || [];

  const emotionCounts = {};
  history.forEach(h => {
    const e = h.emotion?.dominantEmotion || 'neutre';
    emotionCounts[e] = (emotionCounts[e] || 0) + 1;
  });

  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  const dailyMap = {};
  history.slice(-60).forEach(h => {
    const date = h.timestamp.split('T')[0];
    if (!dailyMap[date]) dailyMap[date] = { risks: [], emotions: [] };
    dailyMap[date].risks.push(h.emotion?.riskLevel || 1);
    dailyMap[date].emotions.push(h.emotion?.dominantEmotion || 'neutre');
  });

  const mode = arr => {
    const f = {};
    arr.forEach(v => f[v] = (f[v] || 0) + 1);
    return Object.keys(f).reduce((a, b) => f[a] > f[b] ? a : b, arr[0] || 'neutre');
  };

  const dailyAverages = Object.entries(dailyMap)
    .map(([date, d]) => ({
      date,
      avgRisk: d.risks.reduce((a, b) => a + b, 0) / d.risks.length,
      dominantEmotion: mode(d.emotions)
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const recentMoods = journal
    .filter(j => new Date(j.timestamp) > thirtyAgo)
    .map(j => ({ date: j.timestamp.split('T')[0], mood: j.mood }));

  res.json({
    emotionCounts,
    dailyAverages,
    totalConversations: history.length,
    recentMoods,
    lastEntry: history[history.length - 1] || null
  });
});

// POST /api/emergency
app.post('/api/emergency', (req, res) => {
  const { type, contacts, message } = req.body;

  const emergencies = readData('emergencies.json') || [];
  emergencies.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type,
    message,
    contacts
  });
  writeData('emergencies.json', emergencies);

  console.log('\n🆘 ALERTE URGENCE DÉCLENCHÉE :', { type, timestamp: new Date().toISOString(), contacts });

  res.json({
    success: true,
    message: 'Alerte enregistrée. En production, vos contacts de confiance seraient notifiés automatiquement.'
  });
});

// GET /api/export
app.get('/api/export', (req, res) => {
  const data = {
    exportDate: new Date().toISOString(),
    history: readData('history.json') || [],
    journal: readData('journal.json') || [],
    memory: readData('memory.json') || [],
    contacts: readData('contacts.json') || []
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="aria-export.json"');
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`\n✅ Serveur Aria démarré sur http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY non définie — le chat ne fonctionnera pas.');
    console.log('   Lancez avec : ANTHROPIC_API_KEY=sk-... npm run server\n');
  }
});
