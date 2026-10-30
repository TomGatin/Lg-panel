import { CompositionPreset, RoleDefinition, RoleId } from './types'

export const ROLES: Record<RoleId, RoleDefinition> = {
  loup_garou: {
    id: 'loup_garou',
    name: 'Loup-Garou',
    team: 'loups',
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
    description: 'S\'il est éliminé (nuit ou jour), tire immédiatement un coup de fusil pour éliminer un joueur.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'À sa mort, invitez-le immédiatement à désigner sa cible avant de révéler son rôle.'
  },
  cupidon: {
    id: 'cupidon',
    name: 'Cupidon',
    team: 'village',
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
    description: 'Peut discrètement entrouvrir les yeux pendant le tour des loups. Si elle est surprise, elle est dévorée.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Ne jamais l\'appeler la nuit. Rester vigilant.'
  },
  deux_soeurs: {
    id: 'deux_soeurs',
    name: 'Deux Sœurs',
    team: 'village',
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
    description: 'Au réveil du village, si un loup vivant est assis à sa gauche ou à sa droite, l\'ours grogne.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Le panel vous signale automatiquement chaque matin si vous devez grogner.'
  },
  chevalier_epee_rouillee: {
    id: 'chevalier_epee_rouillee',
    name: 'Chevalier à l\'Épée Rouillée',
    team: 'village',
    description: 'S\'il est dévoré par les loups, il blesse mortellement le premier loup à sa gauche, qui mourra la nuit suivante.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Le panel indique le loup ciblé à sa gauche.'
  },
  ancien: {
    id: 'ancien',
    name: 'Ancien',
    team: 'village',
    description: 'Survit à une première attaque des loups. Si le village le vote au bûcher, tous perdent leurs pouvoirs.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'La potion de la sorcière le tue d\'un coup sans le gracier.'
  },
  villageois: {
    id: 'villageois',
    name: 'Simple Villageois',
    team: 'village',
    description: 'N\'a d\'autre arme que sa voix et sa lucidité pour débusquer les monstres.',
    maxAvailable: 7,
    wakeFrequency: 'never'
  },
  enfant_sauvage: {
    id: 'enfant_sauvage',
    name: 'Enfant Sauvage',
    team: 'ambigu',
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
    description: 'Gagne la partie immédiatement s\'il se fait éliminer lors du tout premier vote du village (Jour 1).',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'S\'il échoue le Jour 1, il devient simple villageois sans pouvoir.'
  },
  carte_vierge: {
    id: 'carte_vierge',
    name: 'Carte Personnalisée',
    team: 'village',
    description: 'Rôle libre selon vos règles maison.',
    maxAvailable: 1,
    wakeFrequency: 'conditional',
    guideNote: 'Rôle personnalisé pour variante de jeu.'
  },
  salvateur: {
    id: 'salvateur',
    name: 'Salvateur',
    team: 'village',
    description: 'Chaque nuit, protège un joueur de l\'attaque des loups. Jamais le même deux nuits de suite.',
    maxAvailable: 1,
    wakeFrequency: 'every_night',
    spokenPrompt: 'Le Salvateur se réveille et me désigne la personne qu\'il protège cette nuit.',
    guideNote: 'Il peut se protéger lui-même. La potion de la Sorcière n\'est pas bloquée.'
  },
  corbeau: {
    id: 'corbeau',
    name: 'Corbeau',
    team: 'village',
    description: 'Chaque nuit, désigne un joueur qui commencera le vote du lendemain avec deux voix contre lui.',
    maxAvailable: 1,
    wakeFrequency: 'every_night',
    spokenPrompt: 'Le Corbeau se réveille et me désigne la personne qu\'il veut accabler demain.',
    guideNote: 'Il peut ne désigner personne.'
  },
  voleur: {
    id: 'voleur',
    name: 'Voleur',
    team: 'village',
    description: 'La 1ère nuit, peut échanger sa carte contre l\'une des deux cartes laissées de côté.',
    maxAvailable: 1,
    wakeFrequency: 'first_night_only',
    spokenPrompt: 'Le Voleur se réveille. Je lui montre les deux cartes : il peut en prendre une.',
    guideNote: 'Si les deux cartes sont des loups, il doit en prendre une. Il joue ensuite le rôle choisi.'
  },
  idiot_du_village: {
    id: 'idiot_du_village',
    name: 'Idiot du Village',
    team: 'village',
    description: 'Si le village vote contre lui, il révèle sa carte et survit, mais ne vote plus.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Un second vote contre lui le tue. Les loups peuvent le dévorer normalement.'
  },
  bouc_emissaire: {
    id: 'bouc_emissaire',
    name: 'Bouc Émissaire',
    team: 'village',
    description: 'En cas d\'égalité au vote, c\'est lui qui est éliminé.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Prime sur le Capitaine pour départager.'
  },
  servante_devouee: {
    id: 'servante_devouee',
    name: 'Servante Dévouée',
    team: 'village',
    description: 'Juste après un vote, peut se révéler pour prendre le rôle du condamné, sans le dévoiler.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Impossible si elle est amoureuse. Le mort est révélé comme Servante.'
  },
  juge_begue: {
    id: 'juge_begue',
    name: 'Juge Bègue',
    team: 'village',
    description: 'Une fois par partie, peut déclencher un second vote immédiatement après le premier.',
    maxAvailable: 1,
    wakeFrequency: 'never',
    guideNote: 'Il convient d\'un signe avec le MJ la première nuit.'
  }
}

export const PRESETS: CompositionPreset[] = [
  {
    name: '8 Joueurs • Classique',
    roles: [
      'loup_garou', 'loup_garou',
      'voyante', 'sorciere', 'chasseur',
      'villageois', 'villageois', 'villageois'
    ]
  },
  {
    name: '10 Joueurs • Les Griffes',
    roles: [
      'loup_garou', 'loup_garou', 'infect_pere_des_loups',
      'voyante', 'sorciere', 'chasseur', 'montreur_ours',
      'cupidon', 'villageois', 'villageois'
    ]
  },
  {
    name: '12 Joueurs • Équilibre Best Of',
    roles: [
      'loup_garou', 'loup_garou', 'grand_mechant_loup',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'chevalier_epee_rouillee',
      'villageois', 'villageois'
    ]
  },
  {
    name: '15 Joueurs • Trahisons & Maléfices',
    roles: [
      'loup_garou', 'loup_garou', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'villageois', 'villageois'
    ]
  },
  {
    name: '18 Joueurs • Grande Assemblée',
    roles: [
      'loup_garou', 'loup_garou', 'loup_garou', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'chien_loup', 'chevalier_epee_rouillee', 'villageois', 'villageois'
    ]
  },
  {
    name: '20 Joueurs • Nuit de Folie',
    roles: [
      'loup_garou', 'loup_garou', 'loup_garou', 'grand_mechant_loup', 'infect_pere_des_loups', 'loup_blanc',
      'voyante', 'sorciere', 'chasseur', 'cupidon', 'petite_fille',
      'montreur_ours', 'renard', 'joueur_de_flute', 'ancien',
      'enfant_sauvage', 'chien_loup', 'chevalier_epee_rouillee', 'deux_soeurs', 'deux_soeurs'
    ]
  }
]
