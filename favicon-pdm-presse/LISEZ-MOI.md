# Favicon — PDM Presse

Icône reprenant exactement la géométrie de celle du Portail Marketing, dans le violet
de l'application PDM Presse (dégradé `#997be9` → `#7b47bf`, la conversion exacte de
la couleur de sa pastille sur le portail).

Ces fichiers sont destinés au dépôt **`PDM_PRESS_APP`**, pas au portail.

## Pose

1. Déposer les six fichiers à la racine du dépôt `PDM_PRESS_APP`.
2. Coller ces lignes dans le `<head>` de la page, juste avant `</head>` :

```html
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32x32.png" sizes="32x32" type="image/png">
<link rel="icon" href="favicon-16x16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
```

Le `favicon.ico` n'a pas besoin d'être déclaré : les navigateurs le cherchent tout
seuls à la racine du site. Il sert aux versions anciennes et aux favoris Windows.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `favicon.svg` | Le principal. Vectoriel, net à toutes les tailles — c'est celui que prennent les navigateurs récents. |
| `favicon.ico` | Secours pour les navigateurs anciens. Contient les tailles 16, 32, 48 et 64 px. |
| `favicon-32x32.png` / `favicon-16x16.png` | Secours PNG pour l'onglet. |
| `apple-touch-icon.png` | 180 px, pour l'ajout à l'écran d'accueil sur iPhone et iPad. |
| `favicon-512.png` | Grand format, utile pour un manifeste d'application ou une réutilisation ultérieure. |

## Bon à savoir

Les navigateurs gardent les favicons en cache longtemps. Après la mise en ligne,
l'ancienne icône peut persister plusieurs jours dans un onglet déjà visité : un
`Ctrl+Maj+R` sur la page, ou une fenêtre de navigation privée, permet de vérifier.
