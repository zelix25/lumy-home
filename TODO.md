
---

# ✅ **TODO LISTE — MVP HomeHub AI+ (Zigbee3 / Zigbee2MQTT / Ultra-simple)**

Je te la réécris par modules, mais avec les contraintes suivantes :
✨ *max simplicité*
✨ *UI pensée pour les néophytes*
✨ *aucun jargon technique visible*
✨ *tous les appareils Zigbee sont détectés automatiquement*

---

# 🏗️ 1. **Base du projet & Architecture**

### Backend (NestJS)

* [x] Init projet NestJS
* [x] Setup MQTT client (connexion directe au broker Zigbee2MQTT)
* [x] Setup DB SQLite (simple, portable)
* [x] Standardiser log, env, validation
* [x] Module WebSocket pour UI

### Frontend (React + MUI)

* [x] Init React
* [x] Intégration thème simple et visuel "grand public"
* [x] Navigation minimaliste :

  * Maison
  * Appareils
  * Scènes/Automations
  * Assistant IA
  * Historique

---

# 🧩 2. **Intégration Zigbee2MQTT (cuore du MVP)**

### Backend

* [x] Module Zigbee2MQTT
* [x] Écouter tous les topics :

  * zigbee2mqtt/bridge/devices
  * zigbee2mqtt/+/state
  * zigbee2mqtt/bridge/event
* [x] Découverte automatique des appareils
* [x] Normalisation des types Zigbee (light, switch, sensor, plug…)
* [x] Stockage en DB (ID, type, nom, état, meta)
* [x] Endpoint REST + WS : liste / état / commandes
* [x] Gestion des renommages utilisateurs (simple et intuitif)
* [x] Détection appareils non supportés avec message clair (sans jargon)

### Frontend

* [x] Page "Appareils" :

  * Cartes simples, grosses icônes
  * Boutons ON/OFF très visibles
  * Labels ultra compréhensibles
* [x] Détails appareil :

  * Réglages de base (luminosité, température couleur, etc.)
  * Historique mini
* [x] Notifications "Nouvel appareil détecté" très user-friendly

---

# 🧠 3. **IA – Génération d'automatisations en langage naturel**

### Backend

* [x] Module IA textuelle
* [x] Gemma 3 (pour local-friendly) - Intégration via Ollama
* [x] Prompt système spécial "grand public"
* [x] Transformer texte → règle JSON simple
* [x] Vérification cohérence :

  * Appareil connu ?
  * Action possible ?
* [x] Interface de validation automatique
* [x] Endpoints REST pour génération et gestion des automatisations
* [x] Entité Automation avec stockage en base de données

### Frontend

* [x] Modale "Créer une règle par phrase"
* [x] Exemple affichés :

  * "Allume la lumière du salon quand j'entre dans la pièce"
  * "Éteins tout quand je pars"
  * "Alerte-moi si une fenêtre reste ouverte"
* [x] Résultat → aperçu non-technique :

  * "Quand le capteur de mouvement du Salon détecte quelque chose → allumer Lumière Salon"
* [x] Page Assistant avec liste des automatisations
* [x] Cartes d'automatisations avec activation/désactivation
* [x] Service API pour communiquer avec le backend IA
* [x] Traductions français/anglais complètes

---

# 👁️ 4. **IA Vision (pour plus tard, mais MVP minimal)**

→ Même si c’est cool, pour un MVP axé Zigbee, on le laisse très simple.

### Backend

* [ ] Module Vision ONNX
* [ ] Détection personne/animal via upload snapshot
* [ ] Génération d’événements internes

### Frontend

* [ ] Page “Caméras AI” (placeholder)
* [ ] Liste des dernières détections

*(Ultra light, juste pour teaser la fonctionnalité.)*

---

# 🔁 5. **Automatisations ultra-simples**

Les utilisateurs novices doivent pouvoir faire des choses *sans écrire de logique*.

### Backend

* [x] Engine d'automation simple "évènement → action"
* [x] Gestion des événements Zigbee standard :

  * mouvement
  * ouverture porte
  * température
  * bouton pressé
* [x] Actions :

  * allumer / éteindre
  * changer intensité
  * envoyer notification
* [x] Endpoint CRUD
* [x] Logs exécution

### Frontend

* [x] Page "Scènes & automatisations"
* [x] Mode guidé (assistant pas à pas) :

  1. Choisir un déclencheur
  2. Choisir un appareil
  3. Choisir une action
* [x] Visualisation simple :
  "Quand il y a du mouvement à l'entrée → Allumer Lumière Entrée"

---

# 📈 6. **Historique et suivi**

### Backend

* [x] HistoryModule
* [x] Enregistrer événements importants :

  * détection mouvement
  * changement état
  * exécution scène
  * appareil online/offline
  * découverte d'appareil
  * changement contact (porte/fenêtre)
  * changement température
* [x] Endpoint filtrable
* [x] Endpoint statistiques
* [x] Intégration avec Zigbee2MqttService pour enregistrement automatique
* [x] Intégration avec AiService pour enregistrement des exécutions d'automatisations

### Frontend

* [x] Page "Historique"
* [x] Timeline simple et claire
* [x] Icônes explicites (mouvement, lumière, porte, etc.)
* [x] Filtres (type d'événement, appareil, pièce)
* [x] Statistiques (total, activité récente, appareil le plus actif)
* [x] Pagination avec "Charger plus"
* [x] Formatage des dates (il y a X minutes/heures/jours)
* [x] Service API pour communiquer avec le backend
* [x] Traductions français/anglais complètes

---

# 🔐 7. **Sécurité et accès simplifié**

### Backend

* [x] Login ultra basique (email + mot de passe)
* [x] JWT
* [x] Option mode "local sans compte" pour la première installation

### Frontend

* [x] Écran de login minimaliste
* [x] Setup assistant à la première ouverture

→ L’assistant doit dire :

> “Je détecte X appareils Zigbee dans la maison. Donne-moi un nom pour chacun.”
> Pas de jargon, pas de complexité.

---

# 🎨 8. **UX “novice-friendly” : Vraiment clé**

* [ ] Icônes grandes et explicites
* [ ] Textes très clairs
* [ ] Jargon technique interdit
* [ ] Messages très humains :

  * “Je viens de détecter une nouvelle ampoule, comment veux-tu l’appeler ?”
  * “Parfait ! Lumière Salon est maintenant connectée.”
* [ ] Page “Aide” simple, avec mini tutoriels

---

# 📦 9. **Déploiement simple**

* [ ] Docker Compose tout-en-un
* [ ] Version ARM pour Raspberry Pi
* [ ] Guide débutant :

  * Installation
  * Découverte appareils
  * Création première scène

---

# 🌟 BONUS — Effet “Woah” spécialement pensé pour les néophytes

* [ ] Mode “Auto-setup bonheur” :

  * HomeHub détecte les capteurs
  * Propose des automatisations de base
  * Genre : “Je vois un capteur de mouvement dans l’entrée → veux-tu une lumière automatique ?”
* [ ] Dashboard “Maison en un coup d’œil”

  * 4 tuiles : Lumières, Température, Ouvertures, Présence

---

# Mode IA 

| Version                     | IA                       | API                       |
| --------------------------- | ------------------------ | ------------------------- |
| **Cloud / Entrée de gamme** | Gemma 3 Cloud            | **Google Vertex AI**      |
| **Local / Premium**         | Gemma 3 local via Ollama | **HTTP local Ollama API** |

Cela donne une expérience identique côté utilisateur (HomeHub → /ai/query), mais avec un backend différent selon la box.

# A reprendre
* [ ] Les setup
