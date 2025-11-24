
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

* [ ] Module IA textuelle
* [ ] Llama 3 (8B max, pour local-friendly)
* [ ] Prompt système spécial "grand public"
* [ ] Transformer texte → règle JSON simple
* [ ] Vérification cohérence :

  * Appareil connu ?
  * Action possible ?
* [ ] Interface de validation automatique

### Frontend

* [ ] Modale "Créer une règle par phrase"
* [ ] Exemple affichés :

  * “Allume la lumière du salon quand j’entre dans la pièce”
  * “Éteins tout quand je pars”
  * “Alerte-moi si une fenêtre reste ouverte”
* [ ] Résultat → aperçu non-technique :

  * “Quand le capteur de mouvement du Salon détecte quelque chose → allumer Lumière Salon”

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

* [ ] Engine d’automation simple “évènement → action”
* [ ] Gestion des événements Zigbee standard :

  * mouvement
  * ouverture porte
  * température
  * bouton pressé
* [ ] Actions :

  * allumer / éteindre
  * changer intensité
  * envoyer notification
* [ ] Endpoint CRUD
* [ ] Logs exécution

### Frontend

* [ ] Page “Scènes & automatisations”
* [ ] Mode guidé (assistant pas à pas) :

  1. Choisir un déclencheur
  2. Choisir un appareil
  3. Choisir une action
* [ ] Visualisation simple :
  “Quand il y a du mouvement à l’entrée → Allumer Lumière Entrée”

---

# 📈 6. **Historique et suivi**

### Backend

* [ ] HistoryModule
* [ ] Enregistrer événements importants :

  * détection mouvement
  * changement état
  * exécution scène
* [ ] Endpoint filtrable

### Frontend

* [ ] Page “Historique”
* [ ] Timeline simple et claire
* [ ] Icônes explicites (mouvement, lumière, porte, etc.)

---

# 🔐 7. **Sécurité et accès simplifié**

### Backend

* [ ] Login ultra basique (email + mot de passe)
* [ ] JWT
* [ ] Option mode “local sans compte” pour la première installation

### Frontend

* [ ] Écran de login minimaliste
* [ ] Setup assistant à la première ouverture

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

