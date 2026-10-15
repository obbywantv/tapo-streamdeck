# Tapo pour Stream Deck

Plugin Elgato Stream Deck pour piloter des ampoules **Tapo L630** (GU10 RGB) depuis le contrôleur local [tapo-l630-controller](https://github.com/pokameni/tapo-l630-controller).

Le plugin ne parle pas aux ampoules. Chaque touche appelle l’API du contrôleur sur `http://127.0.0.1:8000`. Les identifiants Tapo restent dans le `.env` de ce contrôleur. Rainbow et Police sont des boucles côté serveur : si le contrôleur s’arrête, l’effet s’arrête aussi.

```
Touche Stream Deck → plugin Node → FastAPI :8000 → ampoules sur le Wi-Fi local
```

## Action

Une seule action, **Commande**, dans la catégorie **Tapo**. On en pose autant qu’on veut.

- **Cible** : Toutes, ou une ampoule lue via `GET /api/devices`
- **Commande** : Basculer, Allumer, Éteindre, Couleur, Luminosité, Rainbow, Police, Stop
- **URL** et **token** : réglages globaux. L’URL par défaut est `http://127.0.0.1:8000`. Le token Bearer ne sert que si `API_TOKEN` est défini dans le contrôleur.

Basculer une ampoule inverse son état. Basculer **Toutes** éteint tout si au moins une est allumée, sinon allume tout.

La touche affiche le nom et l’état. Le plugin interroge l’API toutes les 3 secondes. Si le contrôleur est arrêté, la touche passe en alerte.

La commande **Couleur** envoie en un seul appui une des 23 couleurs du contrôleur web et la luminosité du curseur. La commande **Luminosité** ne change que l’intensité.

## Prérequis

- Stream Deck 6.9 ou plus récent (testé sur 7.6)
- Node.js 20, fourni par Stream Deck pour exécuter le plugin
- Le contrôleur Python déjà installé et joignable sur le port 8000

## Lancer le contrôleur à la main

Depuis le dossier du contrôleur :

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

## Démarrage avec la session Windows

Sur cette machine, le contrôleur démarre à l’ouverture de session via la tâche planifiée **Tapo L630 Controller**. Ce n’est pas un service Windows : il tourne dans la session de l’utilisateur, sans fenêtre.

Les fichiers dont dépend ce démarrage, et la copie du plugin utilisée par Stream Deck, sont dans :

`%LOCALAPPDATA%\TapoL630`

Soit, sur ce PC : `C:\Users\nook\AppData\Local\TapoL630`

| Fichier | Rôle |
|---|---|
| `start-controller.vbs` | Lance le batch sans console. C’est ce que la tâche planifiée exécute. |
| `start-controller.bat` | Démarre uvicorn et écrit le journal. |
| `controller.log` | Journal du contrôleur. |
| `com.pokameni.tapo.sdPlugin` | Plugin branché dans Stream Deck. |

Ce dossier est dans le profil Windows, pas dans `D:\dev`. Supprimer le dossier de développement ne coupe ni le contrôleur ni le plugin.

Le batch pointe vers :

- le contrôleur : `C:\Users\nook\Documents\GitHub\tapo-l630-controller`
- Python : `C:\Users\nook\AppData\Local\Programs\Python\Python314\python.exe`

Si l’un de ces chemins change, il faut modifier le `.bat` dans `%LOCALAPPDATA%\TapoL630`, pas seulement celui du dépôt.

## Développement

```bash
npm install
npm run build
npm run watch
```

`npm run watch` recompile et redémarre le plugin lié par le CLI Stream Deck. Le lien actuel pointe vers la copie dans `%LOCALAPPDATA%\TapoL630`. Après un build dans ce dépôt, il faut recopier `com.pokameni.tapo.sdPlugin` vers ce dossier, puis redémarrer le plugin :

```bash
npx streamdeck restart com.pokameni.tapo
```

Pour rebrancher le plugin à la main :

```bash
npx streamdeck unlink com.pokameni.tapo
npx streamdeck link "%LOCALAPPDATA%\TapoL630\com.pokameni.tapo.sdPlugin"
```

## Licence

Usage personnel gratuit. **La revente est interdite.** Si tu partages ou réutilises le code, tu dois **créditer pokameni** et garder la licence. Le détail est dans [LICENSE](LICENSE).

## Crédits

- [tapo-l630-controller](https://github.com/pokameni/tapo-l630-controller) — API locale des ampoules
- [Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/) — `@elgato/streamdeck`
- [sdpi-components](https://sdpi-components.dev/) — composants de l’inspecteur, fichier inclus dans `ui/`
