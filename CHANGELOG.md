# Modifications par rapport aux projets d'origine

## 13 novembre 2026

### bimmer/ (bimmer-lab/apps)
- Modes de conduite du X3 30e (pas de Comfort) : Hybrid, Electric, Electric Eco Pro, Electric Individual, Sport, Sport Individual, Sport Plus, Xtraboost, tous reconnus (numéros PHEV et mots) ; trois créneaux pour le changement de thème (Electric Eco Pro / Hybrid / Sport Plus, Sport Plus → thème Sport et les autres → M par défaut) ; jeton `{{modeName}}` (nom exact du mode) et police `mode` (Barlow 22 px) pour le mode écrit en petit en bas à droite des 11 thèmes ; test `tools/test_drive_modes.js`.
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
