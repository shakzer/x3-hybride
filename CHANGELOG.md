# Modifications par rapport aux projets d'origine

## 14 novembre 2026

### bimmer/ (bimmer-lab/apps)
- Cluster Themes : **fenêtre du centre pour Cluster Centre et Cluster Info** (GT3, M, Sport). Le thème l'ouvre quand une de ces apps la demande (`/dev/shm/cluster-themes/window-<app>.json`), publie son rectangle et son état dans `themes.json` (`window`, `open`) ; réglage « Centre window for Cluster Centre / Cluster Info » (onglet Map, activé par défaut). `shared/cluster_info.js`, `shared/hud.js`.
- HUD Widgets : publie la zone libre de sa mise en page pour le panneau de Cluster Info (`hud-layout.json`, `shared/free_rect.js`).
- Tests : `tools/test_cluster_info.js` (fenêtre, zone libre pour chaque mise en page du HUD).

### eroobeeroo/ (eroobeeroo/idrive7-cluster-info)
- Cluster Centre : dans la fenêtre d'un thème, les pages sont réduites à sa taille (`fitBox` dans `pages.js`, petits textes rognés à la fenêtre) ; réglage `yieldThemes` : fenêtre (par défaut) / retrait / afficher quand même ; demande la fenêtre au thème (`shared/yield.js`).
- Cluster Info : réglage « Show the panel » sur le HUD par défaut ; dans la fenêtre d'un thème le panneau reste dans la fenêtre (sans Waze : seul, sauf si les pages de Cluster Centre y sont) ; sur le HUD, il se place dans la zone libre de la mise en page de HUD Widgets ; `apps/cluster_info/yield.js` (copie de `shared/yield.js`).
- Tests : `tools/test_yield.js`, `tools/test_centre.js` (pages dans les fenêtres M et Sport), `kit/tools/test_cluster_info_overlay.js` (fenêtre, zone libre), `kit/tools/test_cluster_info.js` rendu indépendant d'un thème qui tourne.

## 13 novembre 2026

### bimmer/ (bimmer-lab/apps)
- Thème Sport : réglage « lettering at the top » (12 lettrages « ONE OF ONE » / « 1/1 EDITION » en dégradé aux couleurs du M), nouveau type de widget `emblem` (`shared/emblems.js`, `tools/bake_emblems.py`, `tools/test_emblems.js`).
- Modes de conduite du X3 30e (pas de Comfort) : Hybrid, Electric, Electric Eco Pro, Electric Individual, Battery Control (numéro 22), Sport, Sport Individual, Sport Plus, Xtraboost, tous reconnus (numéros PHEV et mots) ; trois créneaux pour le changement de thème (Electric Eco Pro / Hybrid / Sport Plus, Sport Plus → thème M, Electric Eco Pro → thème Sport, Hybrid → cluster d'origine de BMW par défaut) ; jeton `{{modeName}}` (nom exact du mode) et police `mode` (Barlow 22 px) pour le mode écrit en petit en bas à droite des 11 thèmes ; test `tools/test_drive_modes.js`.
- Batterie haute tension (%) et autonomie électrique (km) à la place de l'huile : tous les thèmes du cluster et dispositions du HUD, barres et jauges `evRange` / `hvSoc`, réglage « Electric range when full ».
- Autonomie lue dans la voiture (`KombiIF.displayRangeElectricVehicle`) quand elle existe.
- Réservoir 50 L, moteur 300 Nm / 135 kW, graduations et étiquettes adaptées.
- Chiffres coupés du thème M corrigés ; thème Sport : emplacement du badge texte au bas du cluster comme à l'origine.
- `shared/cluster_info.js` : publie le niveau de batterie pour Cluster Info et signale quand un thème est affiché (pour Cluster Centre) ; test `tools/test_cluster_info.js`.
- Glyphes `%` ajoutés à deux polices (`tools/add_glyphs.py`).

### eroobeeroo/ (eroobeeroo/idrive7-cluster-info)
- Cluster Centre : cède la place à la carte Waze (`shared/yield.js`, `/run/waze-on-cluster/status.json`) et à Cluster Themes ; réglages `yieldWaze` / `yieldThemes` ; activé par défaut, plug-in hybrid, unités métriques, réservoir 50 L, autonomie pleine 40 km.
- Cluster Info : batterie, huile, liquide de refroidissement par défaut, en °C.
- Tests : `tools/test_yield.js`, cas Waze et thème dans `tools/test_centre.js`.
- Cluster Layouts retiré de la liste du Store (`mgu-repo.json`), code conservé.

### Racine
- `mgu-repo.json` : un kit par dossier, les quatre apps.
