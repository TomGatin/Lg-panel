import { RoleDefinition, RoleId } from '../types/game'

export const ROLES_BEST_OF: Record<RoleId, RoleDefinition> = {
  loup_garou: {
    id: 'loup_garou',
    name: 'Loup-Garou',
    team: 'loups',
    emoji: '🐺',
    color: 'text-rose-300 bg-crimson-950/70 border-crimson-800/70',
    description: 'Chaque nuit, se réunit avec les autres loups pour dévorer un villageois.',
    maxAvailable: 3,
    wakeFrequency: 'every_night',
    spokenPrompt: 'Les Loups-Garous se réveillent et désignent silencieusement leur victime.',
    guideNote: 'Les loups doivent s\'accorder d\'un signe de tête unanime.'
  },
  grand_mechant_loup: {
    id: 'grand_mechant_loup',
    name: 'Grand Méchant Loup',
    team: 'loups',
    emoji: '🩸',
    color: 'text-rose-200 bg-crimson-900/80 border-crimson-700',
    description: 'Se réveille avec les loups, puis seul pour dévorer une 2ème victime tant qu\'aucun loup n\'est mort.',
    maxAvailable: 1,
    wakeFrequency: 'conditional',
    spokenPrompt: 'Le Grand Méchant Loup se réveille seul et désigne une seconde victime.',
    guideNote: 'Ne se réveille que si la meute est intacte (aucun loup éliminé).'
  },
  infect_pere_des_loups: {
    id: 'infect_pere_des_loups',
    name: 'Infect Père des Loups',
    team: 'loups',
    emoji: '🧪',
    color: 'text-emerald-300 bg-emerald-950/70 border-emerald-800/70',
    description: 'Une fois par partie, peut infecter la victime des loups au lieu de la tuer (elle devient secrètement loup).',
    maxAvailable: 1,
    wakeFrequency: 'conditional',
    spokenPrompt: 'L\'Infect Père des Loups décide-t-il d\'infecter la victime ce soir ?',
    guideNote: 'Usage unique. La victime survit et rejoint les loups à la nuit suivante.'
  },
  loup_blanc: {
    id: 'loup_blanc',
    name: 'Loup-Garou Blanc',
    team: 'solitaire',
    emoji: '🌕',
    color: 'text-stone-200 bg-stone-850 border-stone-600',
    description: 'Se réveille avec les loups, puis seul une nuit sur deux (nuits paires) pour dévorer un loup.',
    maxAvailable: 1,
    wakeFrequency: 'even_nights',
    spokenPrompt: 'Le Loup-Garou Blanc se réveille et peut éliminer un loup.',
    guideNote: 'Ne gagne que s\'il est l\'unique survivant de tout le village.'
  },
  voyante: {
    id: 'voyante',
    name: 'Voyante',
    team: 'village',
    emoji: '🔮',
    color: 'text-purple-300 bg-purple-950/60 border-purple-800/70',
    description: 'Chaque nuit, peut découvrir la véritable identité secrète d\'un joueur de son choix.',
    maxAvailable: 1,
    wakeFrequency: 'every_night',
    spokenPrompt: 'La Voyante se réveille et me montre une personne dont elle souhaite sonder l\'âme.',
    guideNote: 'Pointez discrètement la carte ou confirmez par signe convenu.'
  },
  sorciere: {
    id: 'sorciere',
    name: 'Sorcière',
    team: 'village',
    emoji: '🧙‍♀️',
    color: 'text-indigo-300 bg-indigo-950/60 border-indigo-800/70',
    description: 'Possède 2 potions à usage unique : 1 de guérison (sauve la victime) et 1 d\'empoisonnement.',
    maxAvailable: 1,
    wakeFrequency: 'every_night',
    spokenPrompt: 'La Sorcière se réveille. Je lui montre la victime des loups. Potion de vie ? Potion de mort ?',
    guideNote: 'Peut utiliser ses deux potions au cours de la même nuit si elle le souhaite.'
  },
  chasseur: {
    id: 'chasseur',
    name: 'Chasseur',
    team: 'village',
    emoji: '🎯',
    color: 'text-amber-300 bg-amber-950/60 border-amber-800/70',
    description: 'S\'il est éliminé (nuit ou jour), tire immédiatement un coup de fusil pour éliminer un joueur.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'À sa mort, invitez-le immédiatement à désigner sa cible avant de révéler son rôle.'
  },
  cupidon: {
    id: 'cupidon',
    name: 'Cupidon',
    team: 'village',
    emoji: '🏹',
    color: 'text-pink-300 bg-pink-950/60 border-pink-800/70',
    description: 'La 1ère nuit uniquement, lie à jamais deux joueurs d\'un amour inconditionnel.',
    maxAvailable: 1,
    wakeFrequency: 'first_night_only',
    spokenPrompt: 'Cupidon se réveille et désigne deux personnes qui seront unies par l\'amour.',
    guideNote: 'Si l\'un meurt, l\'autre meurt instantanément de désespoir.'
  },
  petite_fille: {
    id: 'petite_fille',
    name: 'Petite Fille',
    team: 'village',
    emoji: '👧',
    color: 'text-cyan-300 bg-cyan-950/60 border-cyan-800/70',
    description: 'Peut discrètement entrouvrir les yeux pendant le tour des loups. Si elle est surprise, elle est dévorée.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Ne jamais l\'appeler la nuit. Rester vigilant.'
  },
  deux_soeurs: {
    id: 'deux_soeurs',
    name: 'Deux Sœurs',
    team: 'village',
    emoji: '👭',
    color: 'text-teal-300 bg-teal-950/60 border-teal-800/70',
    description: 'La 1ère nuit uniquement, se réveillent ensemble, se reconnaissent et s\'endorment.',
    maxAvailable: 2,
    wakeFrequency: 'first_night_only',
    spokenPrompt: 'Les Deux Sœurs se réveillent, se reconnaissent et s\'endorment.',
    guideNote: 'Deux villageoises qui ont une certitude mutuelle dès le début.'
  },
  renard: {
    id: 'renard',
    name: 'Renard',
    team: 'village',
    emoji: '🦊',
    color: 'text-orange-300 bg-orange-950/60 border-orange-800/70',
    description: 'Désigne un joueur central et flaire ce joueur et ses 2 voisins. Si au moins 1 loup s\'y trouve, conserve son pouvoir. Sinon, le perd.',
    maxAvailable: 1,
    wakeFrequency: 'conditional',
    spokenPrompt: 'Le Renard se réveille et désigne une personne centrale à flairer avec ses voisins.',
    guideNote: 'Le panel calcule automatiquement si au moins un loup vivant est présent dans le trio.'
  },
  montreur_ours: {
    id: 'montreur_ours',
    name: 'Montreur d\'Ours',
    team: 'village',
    emoji: '🐻',
    color: 'text-brass-300 bg-brass-900/60 border-brass-700/80',
    description: 'Au réveil du village, si un loup vivant est assis à sa gauche ou à sa droite, l\'ours grogne.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Le panel vous signale automatiquement chaque matin si vous devez grogner.'
  },
  chevalier_epee_rouillee: {
    id: 'chevalier_epee_rouillee',
    name: 'Chevalier à l\'Épée Rouillée',
    team: 'village',
    emoji: '🗡️',
    color: 'text-stone-300 bg-stone-900 border-stone-600',
    description: 'S\'il est dévoré par les loups, il blesse mortellement le premier loup à sa gauche, qui mourra la nuit suivante.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Le panel indique le loup ciblé à sa gauche.'
  },
  ancien: {
    id: 'ancien',
    name: 'Ancien',
    team: 'village',
    emoji: '👴',
    color: 'text-yellow-400 bg-stone-900 border-yellow-700/70',
    description: 'Survit à une première attaque des loups. Si le village le vote au bûcher, tous perdent leurs pouvoirs.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'La potion de la sorcière le tue d\'un coup sans le gracier.'
  },
  villageois: {
    id: 'villageois',
    name: 'Simple Villageois',
    team: 'village',
    emoji: '👨‍🌾',
    color: 'text-stone-300 bg-stone-900/90 border-stone-750',
    description: 'N\'a d\'autre arme que sa voix et sa lucidité pour débusquer les monstres.',
    maxAvailable: 7,
    wakeFrequency: 'never'
  },
  enfant_sauvage: {
    id: 'enfant_sauvage',
    name: 'Enfant Sauvage',
    team: 'ambigu',
    emoji: '🏹',
    color: 'text-lime-300 bg-lime-950/60 border-lime-800/70',
    description: 'Choisit un modèle la 1ère nuit. Si son modèle meurt, il rejoint la meute des Loups-Garous.',
    maxAvailable: 1,
    wakeFrequency: 'first_night_only',
    spokenPrompt: 'L\'Enfant Sauvage se réveille et désigne secrètement son modèle.',
    guideNote: 'Tant que son modèle vit, il gagne avec les villageois.'
  },
  chien_loup: {
    id: 'chien_loup',
    name: 'Chien-Loup',
    team: 'ambigu',
    emoji: '🐕',
    color: 'text-stone-300 bg-stone-850 border-stone-700',
    description: 'La 1ère nuit, choisit s\'il veut rester un simple villageois ou devenir loup-garou.',
    maxAvailable: 1,
    wakeFrequency: 'first_night_only',
    spokenPrompt: 'Le Chien-Loup se réveille et choisit son camp : Villageois ou Loup-Garou.',
    guideNote: 'Choix définitif pour le restant de la partie.'
  },
  joueur_de_flute: {
    id: 'joueur_de_flute',
    name: 'Joueur de Flûte',
    team: 'solitaire',
    emoji: '🪈',
    color: 'text-violet-300 bg-violet-950/60 border-violet-800/70',
    description: 'Chaque nuit, charme 2 joueurs vivants. Gagne seul dès que tous les vivants sont charmés.',
    maxAvailable: 1,
    wakeFrequency: 'every_night',
    spokenPrompt: 'Le Joueur de Flûte se réveille et me montre 2 joueurs vivants à envoûter.',
    guideNote: 'Puis le MJ touche discrètement les nouveaux charmés.'
  },
  ange: {
    id: 'ange',
    name: 'Ange',
    team: 'solitaire',
    emoji: '🪽',
    color: 'text-sky-300 bg-sky-950/60 border-sky-800/70',
    description: 'Gagne la partie immédiatement s\'il se fait éliminer lors du tout premier vote du village (Jour 1).',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'S\'il échoue le Jour 1, il devient simple villageois sans pouvoir.'
  },
  carte_vierge: {
    id: 'carte_vierge',
    name: 'Carte Personnalisée',
    team: 'village',
    emoji: '✨',
    color: 'text-parchment-300 bg-stone-900 border-brass-800',
    description: 'Rôle libre selon vos règles maison.',
    maxAvailable: 1,
    wakeFrequency: 'conditional',
    guideNote: 'Rôle personnalisé pour variante de jeu.'
  }
}

export const PRESETS = [
  {
    name: '8 Joueurs • Classique',
    playerCount: 8,
    roles: [
      'loup_garou', 'loup_garou',
      'voyante', 'sorciere', 'chasseur',
      'villageois', 'villageois', 'villageois'
    ] as RoleId[]
  },
  {
    name: '10 Joueurs • Les Griffes',
    playerCount: 10,
    roles: [
      'loup_garou', 'loup_garou', 'infect_pere_des_loups',
      'voyante', 'sorciere', 'chasseur', 'montreur_ours',
      'cupidon', 'villageois', 'villageois'
    ] as RoleId[]
  },
  {
    name: '12 Joueurs • Équilibre Best Of',
    playerCount: 12,
    roles: [
      'loup_garou', 'loup_garou', 'grand_mechant_loup',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'chevalier_epee_rouillee',
      'villageois', 'villageois'
    ] as RoleId[]
  },
  {
    name: '15 Joueurs • Trahisons & Maléfices',
    playerCount: 15,
    roles: [
      'loup_garou', 'loup_garou', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'villageois', 'villageois'
    ] as RoleId[]
  },
  {
    name: '18 Joueurs • Grande Assemblée',
    playerCount: 18,
    roles: [
      'loup_garou', 'loup_garou', 'loup_garou', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'chien_loup', 'chevalier_epee_rouillee', 'villageois', 'villageois'
    ] as RoleId[]
  },
  {
    name: '20 Joueurs • Nuit de Folie',
    playerCount: 20,
    roles: [
      'loup_garou', 'loup_garou', 'loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon', 'petite_fille',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'chien_loup', 'chevalier_epee_rouillee', 'deux_soeurs', 'deux_soeurs'
    ] as RoleId[]
  }
]
