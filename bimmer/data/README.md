# data/

## radars_fr_zones.json

Les zones de danger de la France, pour l'alerte « zone de danger » de Cluster Themes (M Blade et Navi). **Pas encore branchée** : l'app n'a pas la position de la voiture (voir `shared/danger.js`), et ce fichier n'est livré dans aucune app.

- **Source :** Ministère de l'Intérieur, [« Liste des radars fixes en France »](https://www.data.gouv.fr/datasets/liste-des-radars-fixes-en-france/), data.gouv.fr, version du 30 décembre 2025 (3 309 radars fixes, outre-mer compris ; ni radars mobiles ni contrôles de police).
- **Licence :** [Licence Ouverte / Open Licence 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence) (Etalab) : réutilisation libre, à condition de citer la source et la date, ce qui est fait ici.
- **Ce qui a été changé :** le fichier est un jeu de **zones**, pas de radars. Les positions sont arrondies à 0,01° (environ 1 km), les radars d'une même case forment une seule zone (3 003 zones), le type, le numéro et la date sont supprimés. Chaque zone garde la vitesse maximale autorisée (la plus haute de la case, 0 si inconnue) et un drapeau « zone large » (limite de 110 ou plus : autoroute). La recherche (`shared/radar_zones.js`) compte 2 km autour du centre d'une zone, 4 km pour une zone large ; l'arrondi (0,7 km au plus) est bien plus petit que ces rayons, donc le radar reste dans sa zone. Les positions exactes ne sont écrites nulle part dans ce dépôt.
- **Pourquoi des zones :** en France, une aide à la conduite peut annoncer une zone de danger, pas l'emplacement exact ni le type d'un radar (décret n° 2012-3, article R413-15). Ce n'est pas un avis juridique.
- **Refaire le fichier :** télécharger le CSV sur la page ci-dessus, puis `python3 tools/make_radar_zones.py <fichier.csv>`.

Test : `node tools/test_radar_zones.js`.
