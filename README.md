# x3-hybride

Apps iDrive 7 (MGU Store) réglées pour une **BMW X3 30e (G01, 2022)**, un hybride rechargeable : batterie et autonomie électrique partout, les vrais modes de conduite de la voiture, et un centre de cluster qui montre la carte Waze quand elle tourne, les données de la voiture sinon.

C'est une compilation modifiée de projets libres (voir « Crédits et licences »). Rien ici n'est officiel BMW.

> **Important : rien n'a encore été essayé dans une vraie X3 30e.** Tout a été vérifié sur un banc d'essai (rendu image par image des thèmes) et par des tests automatiques. Les points non vérifiés sont listés plus bas, honnêtement.

## Ce que contient le dépôt

| Dossier | Apps | Origine |
|---|---|---|
| `bimmer/` | **Cluster Themes** (11 thèmes du cluster), **HUD Widgets** (10 dispositions du HUD) | [bimmer-lab/apps](https://github.com/bimmer-lab/apps), MIT, modifié |
| `eroobeeroo/` | **Cluster Centre** (pages de données au centre du cluster), **Cluster Info** (petit panneau sur la carte Waze) | [eroobeeroo/idrive7-cluster-info](https://github.com/eroobeeroo/idrive7-cluster-info), PolyForm Noncommercial, modifié |

À installer à côté, depuis leur propre source du Store (non copiés ici, non modifiés) :

- [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps) : **cluster-render** (obligatoire, tout passe par lui) et **Waze on cluster** (la carte Waze dans le cluster ou le HUD).

## Ce qui a été adapté pour le X3 30e

**Modes de conduite.** Le X3 30e a trois modes : **Hybrid**, **Electric Eco Pro** et **Sport** (pas de Comfort). Dans les réglages de Cluster Themes et de HUD Widgets, « Change with HYBRID / ELECTRIC ECO PRO / SPORT » choisit un thème par mode. Par défaut : Sport → thème Sport, Hybrid et Electric Eco Pro → thème M. Le mode est aussi écrit en petit, en bas à droite, dans les 11 thèmes du cluster (« Hybrid », « Electric Eco Pro », « Sport »).

**Batterie et autonomie.** À la place de la température d'huile : le niveau de la batterie haute tension (%) et l'autonomie électrique (km), avec barre ou jauge, dans tous les thèmes et dispositions, M et Sport en priorité. L'autonomie vient de la voiture quand elle l'envoie (`displayRangeElectricVehicle`), sinon c'est la charge multipliée par l'autonomie pleine (réglage « Electric range when full », 40 km par défaut). Réservoir 50 L, moteur thermique 300 Nm / 135 kW par défaut.

**Cluster Info et Cluster Centre.**
- Cluster Themes publie le niveau de batterie pour Cluster Info (`/dev/shm/cluster-info`) : le panneau sur la carte Waze affiche la batterie sans app supplémentaire. Cluster Info démarre avec batterie, huile, liquide de refroidissement, en °C.
- Cluster Centre cède la place à la carte Waze quand Waze on cluster l'affiche (`/run/waze-on-cluster/status.json`, état `showing`), et revient tout seul à l'arrêt. Il cède aussi quand un thème de Cluster Themes couvre le cluster. Deux réglages permettent de forcer l'affichage. Il démarre activé, véhicule « plug-in hybrid », unités métriques.
- **Cluster Layouts** (eroobeeroo) n'est pas proposé dans le Store : il fait le même travail que Cluster Themes (tout le cluster) et les deux ensemble se disputeraient l'écran. Son code reste dans `eroobeeroo/apps/cluster_layouts`.

## Installation (MGU Store)

1. Ajouter la source `robertnisipeanu/idrive-apps`, installer **cluster-render** (et **Waze on cluster** si tu veux la carte Waze).
2. Ajouter la source `shakzer/x3-hybride`, installer **Cluster Themes**, **HUD Widgets**, **Cluster Centre**, **Cluster Info** selon l'envie.
3. Ouvrir chaque app depuis le menu des apps pour choisir les thèmes par mode de conduite.
4. Régler « Time zone (clock) » dans Cluster Themes (l'horloge de l'unité est en UTC).

Le Store compile les apps sur la voiture depuis ce dépôt (`mgu-repo.json`, un kit par dossier).

## Ce qui n'est pas fait, ou pas vérifié

- **Waze : km restants et minutes d'arrivée sur le HUD : impossible.** Waze via CarPlay n'envoie aucune donnée de guidage à la voiture ; Waze on cluster ne transmet que l'image de la carte. Il n'y a donc rien à lire, et je n'invente pas de chiffres.
- **Logos BMW / M : non ajoutés.** Les thèmes gardent leurs éléments d'origine, sans logo ou écriture ajoutés. Le thème Sport a un emplacement de badge texte (onglet Badge) si tu en veux un.
- **Non vérifié sur une vraie voiture :** la lecture du niveau de batterie (lecture seule, calculateur SME, DID DDBC), le signal d'autonomie de la voiture, et les numéros de mode de conduite envoyés par la X3 (déduits du code existant ; si un mode n'est pas reconnu, le journal de l'app donne le numéro reçu, il suffit de me le transmettre).
- Les petites vignettes de prévisualisation dans les pages de réglages n'ont pas été régénérées : elles montrent l'ancien aspect.
- **eDrive** (cauliflowermossgrape/idrive7-apps) n'est pas inclus : il est conçu pour les voitures électriques et je n'ai pas pu le valider sur un hybride rechargeable. Son réglage de batterie par défaut (12 kWh) correspond au 30e.
- **IterioDev/car-apps** est exclu : sa licence (PolyForm Strict) interdit la copie et la modification.

## Vérifier

```sh
cd bimmer && node tools/test_cluster_info.js
cd eroobeeroo && for t in engine app centre data finder logs providers shared signals yield; do node tools/test_$t.js; done
```

Le banc d'essai de `bimmer/` (`node bench/server.js cluster_themes`) rend les thèmes dans un navigateur.

## Crédits et licences

Chaque dossier garde sa licence (voir `LICENSES.md`) : `bimmer/` MIT ; `eroobeeroo/` PolyForm Noncommercial 1.0.0 (usage non commercial uniquement, ni vente ni installation payante), avec son crédit signé laissé intact ; le client `cluster_render_client.js` est sous MPL-2.0 (robertnisipeanu). Modifications : voir `CHANGELOG.md`.

## À tes risques

Apps non officielles, faites par des passionnés, ni approuvées ni soutenues par BMW. Elles ne font que lire des données de la voiture, mais installer des apps tierces sur l'unité principale se fait à tes risques et peut avoir un effet sur la garantie.
