import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Data helpers ──────────────────────────────────────────────────────────────

function readData(f) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }
  catch { return null; }
}

function writeData(f, d) {
  fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MOTEUR IA AUTONOME — aucune API externe
// ═══════════════════════════════════════════════════════════════════════════════

// ── Détection d'émotions par mots-clés (substring, robuste avec accents) ────

const EMOTION_KEYWORDS = {
  danger: {
    score: 10, label: 'Danger critique',
    words: [
      'suicide', 'suicider', 'suicidé', 'me tuer', 'en finir avec la vie',
      'en finir définitivement', 'plus envie de vivre', 'veux mourir', 'veut mourir',
      'mourir', 'me faire du mal', 'me blesser gravement', 'overdose', 'pendaison',
      'me pendre', 'mettre fin à ma vie', 'mettre fin à la vie', 'finir ma vie',
      'ne veux plus exister', 'laisser tout tomber définitivement'
    ]
  },
  severeDepression: {
    score: 7, label: 'Dépression sévère',
    words: [
      'sans espoir', "plus d'espoir", 'désespoir total', 'désespoir profond',
      'tout est fini', 'rien ne vaut rien', 'rien ne vaut la peine', 'à quoi ça sert',
      'plus envie de rien', 'inutile de continuer', 'complètement vide',
      'vide intérieur', 'rien ne change jamais', 'ne ressens plus rien',
      'anesthésiée', 'anesthésié', 'engourdie', 'engourdi', 'tout m\'est égal',
      'dépression sévère', 'dépression majeure', 'effondrée', 'effondré'
    ]
  },
  depression: {
    score: 5, label: 'Dépression',
    words: [
      'déprimé', 'déprimée', 'dépression', 'très triste', 'au fond du gouffre',
      'au fond du trou', 'plus de motivation', 'plus de goût', 'plus envie',
      'épuisé émotionnellement', 'épuisée émotionnellement', 'rien ne va',
      'tout va mal', 'pas bien du tout', 'cafard', 'mélancolie',
      'broyer du noir', 'plus de force', 'ne sert à rien', 'inutile',
      'plus capable', 'lourdeur intérieure', 'perdu dans ma vie', 'perdue dans ma vie'
    ]
  },
  isolation: {
    score: 5, label: 'Isolement',
    words: [
      'me sens seul', 'me sens seule', 'toute seule', 'tout seul',
      'solitude', 'isolé', 'isolée', 'personne ne me', 'personne pour moi',
      'abandonné', 'abandonnée', 'rejeté', 'rejetée', 'incompris', 'incomprise',
      'plus personne', 'personne ne comprend', "personne ne m'écoute",
      "personne ne s'intéresse", 'exclu', 'exclue', 'invisible',
      'pas d\'amis', 'sans amis', 'seul au monde', 'seule au monde'
    ]
  },
  anxiety: {
    score: 4, label: 'Anxiété',
    words: [
      'anxieux', 'anxieuse', 'anxiété', 'panique', 'en panique',
      'angoisse', 'angoisser', 'angoissé', 'angoissée', 'phobie',
      'terreur', 'attaque de panique', "d'angoisse", 'hyperventile',
      'peur intense', 'très inquiet', 'très inquiète', 'boule au ventre',
      "cœur qui s'emballe", 'mains qui tremblent', 'tête qui tourne',
      'tout m\'angoisse', 'tout m\'oppresse', 'paralysé par la peur',
      'paralysée par la peur'
    ]
  },
  stress: {
    score: 3, label: 'Stress',
    words: [
      'stressé', 'stressée', 'stress', 'stressant',
      'débordé', 'débordée', 'surmenage', 'burnout',
      'épuisé', 'épuisée', 'sous pression', 'sous tension',
      "n'en peux plus", 'à bout', 'trop de travail', 'trop de pression',
      'submergé', 'submergée', 'surchargé', 'surchargée', 'écrasé', 'écrasée',
      'plus le temps', 'pas le temps', 'plus dormir', 'pas dormir',
      'plus souffler', 'tout en même temps', 'surcharge'
    ]
  },
  sadness: {
    score: 3, label: 'Tristesse',
    words: [
      'triste', 'tristesse', 'pleurer', 'je pleure', 'larmes',
      'chagrin', 'mélancolie', 'abattu', 'abattue', 'morose', 'sombre',
      'cœur lourd', 'cœur brisé', 'cœur serré', 'avoir la peine',
      'avoir du chagrin', 'tellement triste', 'envie de pleurer',
      'malheureux', 'malheureuse', 'faire de la peine'
    ]
  },
  anger: {
    score: 3, label: 'Colère',
    words: [
      'colère', 'énervé', 'énervée', 'furieux', 'furieuse',
      'rage', 'rageur', 'rageuse', 'agressif', 'agressive',
      'en colère', 'frustré', 'frustrée', 'excédé', 'excédée',
      'insupportable', 'hors de moi', "m'énerve", "m'agace",
      "m'exaspère", 'ras le bol', 'j\'en ai marre', 'bout du rouleau',
      'envie de crier', 'envie de frapper', 'tout casser'
    ]
  },
  positive: {
    score: -1, label: 'Positif',
    words: [
      'je vais bien', 'je me sens bien', 'je me sens mieux', 'ça va bien',
      'ça va mieux', 'heureux', 'heureuse', 'content', 'contente',
      'joie', 'génial', 'excellent', 'fier', 'fière', 'serein', 'sereine',
      'apaisé', 'apaisée', 'confiant', 'confiante', 'optimiste',
      'reconnaissant', 'reconnaissante', 'gratitude', 'épanoui', 'épanouie',
      'bonne humeur', 'bonne journée', 'je progresse', 'ça s\'arrange',
      'ça va mieux', 'je réussi', 'satisfait', 'satisfaite'
    ]
  },
  addiction: {
    score: 5, label: 'Addiction / dépendance',
    words: [
      'alcool', 'boire beaucoup', 'je bois', 'trop bu', 'trop boire',
      'dépendance', 'dépendant', 'dépendante', 'addiction', 'addictif',
      'drogue', 'drogué', 'droguée', 'cannabis', 'cocaïne', 'héroïne',
      'médicaments en excès', 'somnifères', 'anxiolytiques en excès',
      'arrêter de boire', 'alcoolique', 'sobre', 'rechute',
      'je fume trop', 'tabac', 'cigarettes', 'vapote', 'vapotage',
      'jeux d\'argent', 'jeu compulsif', 'achats compulsifs',
      'porno', 'réseaux sociaux compulsifs', 'écrans tout le temps',
      'je mange trop', 'boulimie', 'anorexie', 'purge', 'vomis',
      'laxatifs', 'troubles alimentaires'
    ]
  }
};

function detectEmotion(text) {
  const lower = text.toLowerCase()
    .normalize('NFC'); // normalise les accents

  let maxScore = 0;
  let dominantEmotion = 'neutre';
  let riskScore = 0;
  const detected = [];

  for (const [key, { score, label, words }] of Object.entries(EMOTION_KEYWORDS)) {
    if (key === 'positive') continue; // handled separately below
    for (const word of words) {
      if (lower.includes(word)) {
        if (!detected.find(e => e.key === key)) detected.push({ key, label, score });
        if (score > maxScore) { maxScore = score; dominantEmotion = key; }
        riskScore = Math.max(riskScore, Math.max(0, score));
        break;
      }
    }
  }

  // Positive uniquement si aucune émotion négative détectée
  if (dominantEmotion === 'neutre') {
    for (const word of EMOTION_KEYWORDS.positive.words) {
      if (lower.includes(word)) {
        dominantEmotion = 'positive';
        detected.push({ key: 'positive', label: 'Positif', score: -1 });
        break;
      }
    }
  }

  const riskLevel = riskScore >= 8 ? 3 : riskScore >= 4 ? 2 : 1;

  return {
    dominantEmotion,
    dominantLabel: EMOTION_KEYWORDS[dominantEmotion]?.label || 'Neutre',
    detectedEmotions: detected,
    riskScore,
    riskLevel,
    timestamp: new Date().toISOString()
  };
}

// ── Bibliothèque de réponses ──────────────────────────────────────────────────

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const R = {

  welcome: [
    `Bonjour, je suis **Aria**, votre espace d'écoute bienveillant. 🌿\n\nJe suis là pour vous accompagner, sans jugement, à n'importe quelle heure. Vous pouvez me parler de ce qui vous traverse — une émotion, une situation, une pensée qui tourne en boucle.\n\nComment vous sentez-vous en ce moment ?`,
    `Bonjour. Je m'appelle **Aria**, je suis votre assistant d'accompagnement psychologique. 🌿\n\nCet espace est le vôtre. Exprimez-vous librement — je suis là pour vous écouter sans vous juger, et vous accompagner du mieux possible.\n\nQu'est-ce qui vous amène aujourd'hui ?`,
    `Bonjour et bienvenue. Je suis **Aria**. 🌿\n\nMon rôle est simple : vous écouter, vous soutenir, et vous aider à traverser les moments difficiles — comme les moments plus sereins.\n\nComment allez-vous aujourd'hui ?`
  ],

  shortMessage: [
    `Je vous entends. Pouvez-vous m'en dire un peu plus sur ce que vous ressentez en ce moment ?`,
    `Je suis là. Qu'est-ce qui se passe pour vous en ce moment ?`,
    `Je vous écoute. N'hésitez pas à partager ce qui vous traverse, même si c'est difficile à mettre en mots.`,
    `Je suis attentive. Que souhaitez-vous me dire ?`,
    `Prenez le temps qu'il vous faut. Qu'est-ce qui vous préoccupe, vous pèse, ou vous traverse en ce moment ?`
  ],

  danger: [
    `Je vous entends profondément, et je veux que vous sachiez que je suis là avec vous dans ce moment.\n\nCe que vous traversez est une douleur immense — et elle mérite toute l'attention d'un professionnel.\n\n**Appelez maintenant :**\n- **3114** — Numéro national prévention suicide (gratuit, 24h/24, confidentiel)\n- **15** — SAMU si vous êtes en danger immédiat\n\nPouvez-vous m'assurer que vous êtes en sécurité là où vous êtes en ce moment ?`,
    `Je vous entends. Ce que vous vivez est une souffrance profonde, et vous n'êtes pas seul(e) dans ce moment.\n\nS'il vous plaît, contactez le **3114** maintenant — c'est gratuit, confidentiel, disponible 24h/24. Des personnes formées pour ce type de douleur sont là pour vous.\n\nY a-t-il quelqu'un près de vous, ou quelqu'un que vous pourriez appeler ?`,
    `Votre douleur est réelle, et elle mérite d'être entendue par quelqu'un qui peut vraiment vous aider maintenant.\n\nS'il vous plaît, appelez le **3114** — c'est un numéro dédié, gratuit, confidentiel. Vous n'avez pas à traverser ça seul(e).\n\nJe reste là. Dites-moi : êtes-vous en sécurité en ce moment ?`
  ],

  severeDepression: [
    `Ce que vous décrivez — ce sentiment d'impasse, de vide — est une souffrance que je prends très au sérieux.\n\nVous méritez un soutien professionnel. Un psychologue peut vous aider à traverser ça d'une façon que je ne peux pas offrir seul(e).\n\nEn attendant, je suis là. Qu'est-ce qui vous pèse le plus en ce moment ?`,
    `Ce désespoir que vous ressentez n'est pas une vérité permanente sur votre vie — même si ça peut sembler ainsi en ce moment.\n\nJe vous encourage vraiment à parler avec un professionnel — médecin, psychologue. Vous pouvez aussi appeler le **3114** pour un soutien immédiat.\n\nVoulez-vous me partager ce qui a amené les choses à ce point ?`,
    `La souffrance que vous décrivez est réelle et profonde. Je vous entends.\n\nIl existe de l'aide au-delà de moi — des professionnels formés pour ce type de douleur. Un médecin traitant peut déjà être un premier pas accessible.\n\nY a-t-il quelqu'un dans votre vie — famille, ami, médecin — à qui vous pourriez parler aujourd'hui ?`
  ],

  depression: [
    `Je vous entends. Ce que vous traversez est réellement difficile, et c'est tout à fait humain de se sentir ainsi.\n\nLa dépression n'est pas une faiblesse — c'est quelque chose qui arrive à des personnes fortes, et qui mérite soin et attention.\n\nEst-ce que c'est quelque chose qui dure depuis longtemps, ou c'est plus récent pour vous ?`,
    `Ce sentiment de ne plus avoir d'énergie, de motivation… Je comprends que c'est épuisant à vivre. Vous n'avez pas à faire semblant que tout va bien.\n\nParfois, un tout petit pas aide : une chose simple et douce pour vous aujourd'hui — même minuscule. Qu'est-ce qui vous viendrait à l'esprit ?\n\nEt si ça dure depuis plusieurs semaines, parler à un médecin serait vraiment utile.`,
    `Merci de me partager ça. Ce que vous décrivez mérite attention et bienveillance.\n\nQuand on ne va pas bien, on a souvent tendance à s'isoler davantage — ce qui ne fait qu'aggraver les choses. Y a-t-il quelqu'un avec qui vous pourriez passer un moment, même brièvement ?\n\nQu'est-ce qui vous apportait un peu de plaisir ou de calme, avant ?`,
    `Je vous entends. Le quotidien peut devenir très lourd.\n\nUn exercice simple : pensez à **une seule chose positive** — même minuscule — qui s'est passée ces derniers jours. Pas pour nier ce qui est difficile, mais pour nourrir la partie de vous qui cherche encore la lumière.\n\nQu'est-ce qui vous a mis un tout petit peu du baume au cœur récemment, même une seconde ?`
  ],

  isolation: [
    `Se sentir seul(e) est une des souffrances les plus profondes. Je vous entends, et je suis là.\n\nLa solitude crée souvent un cercle : on s'isole parce qu'on souffre, et on souffre davantage en s'isolant. Mais de petits pas existent pour l'interrompre.\n\nY a-t-il quelqu'un — même quelqu'un avec qui vous n'avez plus parlé depuis longtemps — à qui vous pourriez envoyer un message simple aujourd'hui ?`,
    `Ce sentiment d'être invisible, de n'être compris(e) par personne… c'est une vraie douleur. Vous avez eu raison de le dire ici.\n\nParfois, l'isolement vient d'un sentiment de ne pas mériter la connexion — une croyance fausse, mais tenace. Est-ce que ça vous parle ?\n\nIl existe aussi des espaces de soutien collectif — groupes d'écoute, associations — où trouver de la chaleur humaine sans pression.`,
    `Je suis là avec vous. Vous n'êtes pas seul(e) en ce moment précis, même si ça peut sembler ainsi.\n\nCette sensation de ne pas être compris(e) — est-ce récent ou un sentiment de longue date ?\n\nMême un tout petit lien humain peut faire une grande différence : un sourire échangé, un message envoyé. Quel serait le plus petit pas possible pour vous aujourd'hui ?`
  ],

  anxiety: [
    `Je comprends cette sensation — l'anxiété peut être vraiment épuisante et envahissante.\n\nEssayons ensemble un exercice rapide :\n\n**Respiration 4-7-8 :**\n1. Inspirez par le nez — **4 secondes**\n2. Retenez — **7 secondes**\n3. Expirez lentement par la bouche — **8 secondes**\n\nRépétez 3 fois. Puis dites-moi : qu'est-ce qui déclenche cette anxiété en ce moment ?`,
    `L'anxiété donne l'impression que tout est urgent et dangereux — alors que souvent, notre esprit amplifie la menace. Ce n'est pas de votre faute, c'est un mécanisme de survie qui s'emballe.\n\nEssayez l'ancrage sensoriel :\nNommez mentalement **5 choses** que vous voyez autour de vous en ce moment. Prenez le temps. Ça ramène dans le présent.\n\nQu'est-ce qui vous préoccupe concrètement là ?`,
    `Je vous entends. Cette tension, ce sentiment que quelque chose va mal tourner… c'est éprouvant.\n\nMettez des mots précis sur ce qui angoisse — ça aide souvent à réduire son emprise. Votre cerveau génère des scénarios du pire par peur, pas des réalités.\n\nQu'est-ce qui vous préoccupe le plus en ce moment ?`,
    `Votre corps réagit à une perception de danger. L'anxiété vous protège — même si parfois de façon trop zélée.\n\n**Respiration carrée pour vous ancrer :**\n4s inspirez → 4s retenez → 4s expirez → 4s retenez. 4 fois.\n\nNommer la peur lui enlève souvent de son pouvoir. Qu'est-ce qui vous fait peur précisément ?`
  ],

  stress: [
    `Je vous entends. Cette sensation d'être submergé(e), de ne plus savoir par où commencer — c'est un signal que votre corps a besoin d'une pause.\n\nArrêtons-nous un instant. **Respirez lentement, 3 fois.** Vraiment.\n\nMaintenant : si vous ne deviez garder qu'une seule chose à gérer aujourd'hui, ce serait laquelle ?`,
    `Le stress à ce niveau-là est épuisant. Votre corps est en alerte permanente.\n\nUne technique efficace : pendant 5 minutes, notez tout ce qui vous stresse sans filtre. Juste l'écrire suffit à désencombrer l'esprit.\n\nEnsuite : dans cette liste, y a-t-il des choses que vous pourriez déléguer, reporter, ou simplement laisser tomber ?`,
    `Quand tout s'accumule, c'est difficile de voir clair. Je vous comprends.\n\nVous avez besoin d'une vraie pause — pas 5 minutes sur un écran, mais quelque chose qui dit à votre système nerveux "tu peux te détendre". Une marche courte, une douche chaude, des étirements.\n\nC'est quoi la principale source de stress en ce moment — pro, perso, les deux ?`,
    `Le stress chronique, c'est comme courir sans jamais toucher la ligne d'arrivée. Ça use profondément.\n\nQuestion importante : y a-t-il un moment dans votre journée, même court, où vous vous sentez un peu plus léger(e) ? Identifier ces moments aide à les construire consciemment.\n\nQu'est-ce qui vous a fait le plus de pression cette semaine ?`
  ],

  sadness: [
    `Je vous entends. La tristesse mérite d'être accueillie, pas combattue — elle a quelque chose à nous dire.\n\nLaissez-vous ressentir ce que vous ressentez, sans vous en vouloir. Les larmes ont une fonction libératrice.\n\nVoulez-vous me raconter ce qui s'est passé ?`,
    `Cette tristesse que vous portez… je la sens dans vos mots, et je suis là avec vous.\n\nParfois on n'a pas besoin de solutions, juste d'être entendu(e). Je suis là pour ça.\n\nY a-t-il quelqu'un dans votre entourage avec qui vous vous sentez en sécurité pour partager ce que vous vivez ?`,
    `Ce que vous traversez est douloureux, et votre tristesse est tout à fait légitime.\n\nÉcrire ce que vous ressentez, sans censure, peut aider — dans le journal ici, ou n'importe où. Ça met en forme ce qui est encore flou.\n\nQu'est-ce qui a déclenché cette tristesse ?`,
    `Je suis là. Vous n'avez pas à aller bien si vous n'allez pas bien.\n\nLa tristesse signale souvent quelque chose d'important — une perte, une déception, un manque. Elle mérite attention, pas minimisation.\n\nQu'est-ce qui vous manque en ce moment, au fond ?`
  ],

  anger: [
    `Je vous entends. Cette colère est réelle, et elle mérite d'être reconnue.\n\nLa colère est souvent une émotion de surface qui recouvre quelque chose — de la douleur, une injustice, de la peur. Elle n'est pas mauvaise en soi ; c'est un signal.\n\nQu'est-ce qui s'est passé pour que vous ressentiez ça ?`,
    `Cette colère signale que quelque chose d'important pour vous a été touché — une valeur, une limite, un besoin non respecté.\n\nAvant de réagir, laisser passer l'intensité aide. **Respirez :** 4 secondes inspirer, 8 secondes expirer lentement.\n\nQu'est-ce qui vous a mis dans cet état ? Racontez-moi.`,
    `La colère peut être une énergie puissante — destructrice si mal canalisée, transformatrice si bien orientée.\n\nPour décharger l'intensité : de l'activité physique aide vraiment (marcher vite 10 minutes, par exemple).\n\nMais dites-moi : c'est quoi la situation concrètement ?`,
    `Je vous entends, et votre réaction est compréhensible.\n\nPour aller plus loin : qu'est-ce qui vous a vraiment blessé(e) dans cette situation ? Quelle limite a été franchie ? Et qu'est-ce que vous auriez voulu qu'il se passe à la place ?\n\nRegarder derrière la colère aide à comprendre ce dont on a réellement besoin.`
  ],

  positive: [
    `C'est vraiment beau à entendre. Ce bien-être mérite d'être savouré pleinement.\n\nComment vous y prenez-vous pour cultiver ces bons moments ? Y a-t-il quelque chose en particulier qui a changé ?`,
    `Je suis sincèrement heureuse de vous entendre aller mieux. Ces moments sont précieux.\n\nÀ votre avis, qu'est-ce qui a contribué à ce que vous vous sentiez ainsi ? Identifier ces leviers vous permet de les activer consciemment.`,
    `Reconnaître quand on va bien, c'est déjà une forme de sagesse. \n\nY a-t-il des choses, des habitudes, ou des personnes qui ont contribué à ce bien-être ? Je suis curieuse.`,
    `Ça fait vraiment du bien d'entendre ça ! Le bonheur mérite autant d'attention que les difficultés.\n\nEst-ce que vous sentez que les choses évoluent dans le bon sens par rapport à avant ? Qu'est-ce qui a changé ?`
  ],

  neutral: [
    `Je vous écoute attentivement. Pouvez-vous me dire un peu plus ce qui se passe pour vous en ce moment ?`,
    `Pour mieux vous accompagner : comment vous sentez-vous émotionnellement ? Y a-t-il quelque chose qui vous pèse ou vous préoccupe ?`,
    `Je suis là pour vous. Souhaitez-vous parler de quelque chose en particulier, ou juste partager ce qui vous traverse ?`,
    `Parfois mettre des mots sur ce qu'on ressent prend du temps. Prenez celui qu'il vous faut.\n\nQu'est-ce qui vous a amené(e) ici aujourd'hui ?`,
    `Je suis attentive. Dites-moi — est-ce que quelque chose vous préoccupe, ou avez-vous juste envie de discuter ?`
  ],

  followup: {
    depressionRepeat: `\n\n---\nCela fait plusieurs fois qu'on aborde ces sentiments — je veux vous dire quelque chose d'important : vous méritez d'être aidé(e) par un professionnel. Un médecin ou un psychologue peut faire vraiment la différence. C'est quelque chose que vous pourriez envisager ?`,
    anxietyRepeat: `\n\n---\nL'anxiété semble être quelque chose de récurrent pour vous. Un thérapeute — notamment en TCC (thérapie cognitivo-comportementale) — peut vous aider à en trouver les racines et à la gérer durablement. Vous avez peut-être déjà exploré cette option ?`,
    stressWorsening: `\n\n---\nJe remarque que ce niveau de stress semble durer. C'est un signal que votre corps mérite un vrai soutien. Avez-vous pensé à en parler à votre médecin ?`,
    generalProgress: `\n\n---\nComment évaluez-vous votre état aujourd'hui par rapport au début de nos échanges ? Reconnaître les progrès, même petits, est important.`
  },

  addiction: [
    `Merci de me partager ça — il faut du courage pour le reconnaître.\n\nLa consommation excessive est souvent une façon de gérer quelque chose de plus profond : un stress intense, une douleur émotionnelle, un vide. Je ne suis pas là pour vous juger — je suis là pour comprendre.\n\nQu'est-ce que vous pensez que cette consommation vous apporte, au fond ? Qu'est-ce qu'elle anesthésie ou remplace ?`,
    `Je vous entends. Ce que vous décrivez mérite attention et bienveillance, pas jugement.\n\nLa dépendance — qu'elle soit à l'alcool, aux substances, ou à d'autres comportements — est souvent un signal que quelque chose souffre en vous. Quelque chose qui cherche à être soulagé.\n\nDepuis combien de temps est-ce que c'est ainsi ? Et y a-t-il des moments où c'est pire que d'autres ?`,
    `Ce que vous partagez demande de l'honnêteté envers soi-même — et ça, c'est déjà un premier pas important.\n\nJe veux vous dire quelque chose : vous n'avez pas à traverser ça seul(e). Des professionnels spécialisés dans l'accompagnement des dépendances existent, sans jugement, avec des solutions concrètes.\n\nAvez-vous déjà essayé de réduire ou d'arrêter ? Comment ça s'est passé ?`,
    `Je vous entends, et je prends ça au sérieux.\n\nUne chose importante : la dépendance modifie le cerveau d'une façon qui rend le "juste arrêter" très difficile — ce n'est pas une question de volonté. C'est une question de soutien adapté.\n\n**Alcool Info Service : 0 980 980 930** (gratuit, anonyme, 7j/7) peut être un premier contact simple et confidentiel.\n\nQu'est-ce qui vous a amené(e) à consommer autant ?`
  ],

};

// ── Génération de réponse ─────────────────────────────────────────────────────

function generateResponse(message, emotion, history) {
  const msgLen = message.trim().length;
  const emo = emotion.dominantEmotion;
  const risk = emotion.riskLevel;

  // Message trop court → relancer (sauf urgence)
  if (msgLen < 20 && !['danger', 'severeDepression'].includes(emo)) {
    return pick(R.shortMessage);
  }

  // Danger → réponse de crise
  if (emo === 'danger' || risk === 3) return pick(R.danger);

  // Nombre de fois que cette émotion a été exprimée auparavant
  const emoCount = history.filter(h => h.emotion?.dominantEmotion === emo).length;

  let base;

  if (emo === 'severeDepression') {
    base = pick(R.severeDepression);
    if (emoCount > 1) base += R.followup.depressionRepeat;
  } else if (R[emo]) {
    base = pick(R[emo]);
    if (emo === 'depression' && emoCount > 2) base += R.followup.depressionRepeat;
    else if (emo === 'anxiety' && emoCount > 2) base += R.followup.anxietyRepeat;
    else if (emo === 'stress' && emoCount > 3) base += R.followup.stressWorsening;
    else if (emo === 'positive' && history.length > 5) base += R.followup.generalProgress;
  } else {
    base = pick(R.neutral);
  }

  return base;
}

// ── Suggestions par émotion ───────────────────────────────────────────────────

const SUGGESTIONS = {
  danger: [
    { type: 'emergency', text: '3114 — Prévention suicide (gratuit, 24h/24)', icon: '🆘' },
    { type: 'emergency', text: '15 — SAMU', icon: '🚑' },
    { type: 'action', text: 'Contacter un proche maintenant', icon: '📞' }
  ],
  severeDepression: [
    { type: 'professional', text: 'Consulter un psychologue ou psychiatre', icon: '👩‍⚕️' },
    { type: 'emergency', text: '3114 si vous avez besoin de parler', icon: '🆘' },
    { type: 'exercise', text: 'Respiration 4-7-8', icon: '🌬️' }
  ],
  depression: [
    { type: 'exercise', text: 'Marche de 10 min en plein air', icon: '🚶' },
    { type: 'exercise', text: 'Exercice de gratitude : 3 choses positives', icon: '✨' },
    { type: 'professional', text: 'En parler à un médecin traitant', icon: '👩‍⚕️' }
  ],
  isolation: [
    { type: 'action', text: 'Envoyer un message à quelqu\'un', icon: '💬' },
    { type: 'action', text: 'Sortir, même 15 minutes', icon: '🌿' },
    { type: 'professional', text: 'Groupes de soutien en ligne', icon: '👥' }
  ],
  anxiety: [
    { type: 'exercise', text: 'Respiration carrée 4-4-4-4', icon: '🌬️' },
    { type: 'exercise', text: 'Ancrage sensoriel 5-4-3-2-1', icon: '🌟' },
    { type: 'exercise', text: 'Relaxation musculaire progressive', icon: '💆' }
  ],
  stress: [
    { type: 'exercise', text: 'Pause respiration : 5 minutes', icon: '🌬️' },
    { type: 'action', text: 'Lister 3 priorités seulement', icon: '📝' },
    { type: 'exercise', text: 'Étirements doux (cou, épaules)', icon: '🤸' }
  ],
  sadness: [
    { type: 'exercise', text: 'Écrire librement dans le journal', icon: '✍️' },
    { type: 'action', text: 'Appeler quelqu\'un de proche', icon: '💬' },
    { type: 'exercise', text: 'Faire une activité qui vous fait du bien', icon: '🎯' }
  ],
  anger: [
    { type: 'exercise', text: 'Respiration longue : 4s inspir, 8s expir', icon: '🌬️' },
    { type: 'exercise', text: 'Marche rapide pour décharger', icon: '🚶' },
    { type: 'action', text: 'Écrire votre colère sans filtre', icon: '✍️' }
  ],
  positive: [
    { type: 'exercise', text: 'Écrire ce qui a contribué à ce bien-être', icon: '📝' },
    { type: 'exercise', text: 'Pleine conscience 3 minutes', icon: '🧘' }
  ],
  addiction: [
    { type: 'professional', text: 'Consulter un addictologue ou médecin', icon: '👩‍⚕️' },
    { type: 'emergency', text: 'Alcool Info Service : 0 980 980 930', icon: '📞' },
    { type: 'action', text: 'Identifier les déclencheurs de la consommation', icon: '📝' },
    { type: 'professional', text: 'Groupes de soutien (AA, NA, Al-Anon…)', icon: '👥' }
  ],
  neutre: [
    { type: 'exercise', text: 'Journal émotionnel du jour', icon: '📝' },
    { type: 'exercise', text: 'Pleine conscience 3 minutes', icon: '🧘' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTES API
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'standalone', timestamp: new Date().toISOString() });
});

// POST /api/chat
app.post('/api/chat', (req, res) => {
  const { message, conversationHistory = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message manquant' });

  const memory = readData('memory.json') || [];
  const emotion = detectEmotion(message);

  // Premier message court → accueil
  const isFirst = conversationHistory.length === 0;
  const response = (isFirst && message.trim().length < 30)
    ? pick(R.welcome)
    : generateResponse(message, emotion, conversationHistory);

  // Persister
  const history = readData('history.json') || [];
  history.push({ id: Date.now(), timestamp: new Date().toISOString(), userMessage: message, aiResponse: response, emotion });
  if (history.length > 200) history.splice(0, history.length - 200);
  writeData('history.json', history);

  // Auto-mémoriser les messages significatifs
  if (message.length > 40) {
    memory.push({ id: Date.now(), timestamp: new Date().toISOString(), content: message.substring(0, 250), emotion: emotion.dominantEmotion, riskLevel: emotion.riskLevel, auto: true });
    if (memory.length > 100) memory.splice(0, memory.length - 100);
    writeData('memory.json', memory);
  }

  res.json({
    response,
    emotion,
    suggestions: SUGGESTIONS[emotion.dominantEmotion] || SUGGESTIONS.neutre,
    requiresEmergency: emotion.riskLevel >= 3
  });
});

// GET /api/history
app.get('/api/history', (req, res) => res.json(readData('history.json') || []));

// DELETE /api/history
app.delete('/api/history', (req, res) => { writeData('history.json', []); res.json({ success: true }); });

// GET /api/memory
app.get('/api/memory', (req, res) => res.json(readData('memory.json') || []));

// POST /api/memory
app.post('/api/memory', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu manquant' });
  const m = readData('memory.json') || [];
  m.push({ id: Date.now(), timestamp: new Date().toISOString(), content: content.trim(), manual: true });
  writeData('memory.json', m);
  res.json({ success: true });
});

// DELETE /api/memory/:id
app.delete('/api/memory/:id', (req, res) => {
  writeData('memory.json', (readData('memory.json') || []).filter(m => m.id !== parseInt(req.params.id)));
  res.json({ success: true });
});

// DELETE /api/memory
app.delete('/api/memory', (req, res) => { writeData('memory.json', []); res.json({ success: true }); });

// GET /api/contacts
app.get('/api/contacts', (req, res) => res.json(readData('contacts.json') || []));

// POST /api/contacts
app.post('/api/contacts', (req, res) => {
  const { name, phone, relation, isEmergency } = req.body;
  if (!name?.trim() || !phone?.trim()) return res.status(400).json({ error: 'Nom et téléphone requis' });
  const c = readData('contacts.json') || [];
  c.push({ id: Date.now(), name: name.trim(), phone: phone.trim(), relation: relation || 'Autre', isEmergency: !!isEmergency, createdAt: new Date().toISOString() });
  writeData('contacts.json', c);
  res.json({ success: true });
});

// DELETE /api/contacts/:id
app.delete('/api/contacts/:id', (req, res) => {
  writeData('contacts.json', (readData('contacts.json') || []).filter(c => c.id !== parseInt(req.params.id)));
  res.json({ success: true });
});

// GET /api/journal
app.get('/api/journal', (req, res) => res.json(readData('journal.json') || []));

// POST /api/journal
app.post('/api/journal', (req, res) => {
  const { content, emotion, mood } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' });
  const j = readData('journal.json') || [];
  j.push({ id: Date.now(), timestamp: new Date().toISOString(), content: content.trim(), emotion: emotion || 'neutre', mood: Math.min(10, Math.max(1, parseInt(mood) || 5)) });
  writeData('journal.json', j);
  res.json({ success: true });
});

// DELETE /api/journal/:id
app.delete('/api/journal/:id', (req, res) => {
  writeData('journal.json', (readData('journal.json') || []).filter(j => j.id !== parseInt(req.params.id)));
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
    .map(([date, d]) => ({ date, avgRisk: d.risks.reduce((a, b) => a + b, 0) / d.risks.length, dominantEmotion: mode(d.emotions) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const thirtyAgo = new Date(Date.now() - 30 * 864e5);
  const recentMoods = journal.filter(j => new Date(j.timestamp) > thirtyAgo).map(j => ({ date: j.timestamp.split('T')[0], mood: j.mood }));

  res.json({ emotionCounts, dailyAverages, totalConversations: history.length, recentMoods, lastEntry: history[history.length - 1] || null });
});

// POST /api/emergency
app.post('/api/emergency', (req, res) => {
  const { type, contacts, message } = req.body;
  const e = readData('emergencies.json') || [];
  e.push({ id: Date.now(), timestamp: new Date().toISOString(), type, message, contacts });
  writeData('emergencies.json', e);
  console.log('\n🆘 ALERTE URGENCE :', { type, timestamp: new Date().toISOString() });
  res.json({ success: true, message: 'Alerte enregistrée.' });
});

// GET /api/export
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="aria-export.json"');
  res.json({ exportDate: new Date().toISOString(), history: readData('history.json') || [], journal: readData('journal.json') || [], memory: readData('memory.json') || [], contacts: readData('contacts.json') || [] });
});

app.listen(PORT, () => {
  console.log(`\n✅ Serveur Aria (mode autonome) — http://localhost:${PORT}`);
  console.log('   Aucune API externe requise — moteur IA 100% intégré.\n');
});
