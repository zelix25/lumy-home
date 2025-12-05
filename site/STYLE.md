# 🎨 **STYLE GUIDE – EXO HOME**

## *Version 1.0 – Directive pour l’équipe UI/Frontend*

---

# 1. **IDENTITÉ GLOBALE**

### 🔹 **Ton de la marque**

* Simple
* Futuriste mais rassurant
* Accessible aux novices
* Intelligent mais jamais intimidant
* Clean, épuré, sans surcharge

### 🔹 **Positionnement**

“Exo Home rend la maison intelligente… compréhensible par tout le monde.”

### 🔹 **Objectif UX**

Réduire la complexité → transformer la domotique en quelque chose de **clair, intuitif, prévisible**.

---

# 2. **TYPOGRAPHIE**

### 🔹 **Police principale (UI / Branding)**

**Inter** (ou équivalent : “Outfit” si besoin de plus futuriste)

* Moderne
* Hautement lisible
* Universelle et stable

### 🔹 **Hiérarchie**

| Style | Police | Poids | Usage                |
| ----- | ------ | ----- | -------------------- |
| H1    | Inter  | 700   | Titres pages         |
| H2    | Inter  | 600   | Sous-titres bloc     |
| H3    | Inter  | 500   | Catégories / labels  |
| Body  | Inter  | 400   | Textes, instructions |
| Small | Inter  | 300   | Infos secondaires    |

Toujours privilégier une **lecture simple**, sans fioriture.

---

# 3. **PALETTE COULEURS**

Inspirée : **tech minimaliste + futur apaisant + “high-end”**
Modes : **Light & Dark**

---

## 🌗 **Mode Sombre (par défaut)**

| Élément              | Couleur | Rôle                      |
| -------------------- | ------- | ------------------------- |
| Background principal | #121416 | Ambiance futuriste, sobre |
| Surfaces (cards)     | #1A1D1F | Légèrement contrasté      |
| Accents bleu-cyan    | #2ACBEF | Identité Exo Home         |
| Accent secondaire    | #6EE7F8 | Hover & highlights        |
| Texte principal      | #FFFFFF | Contraste maximal         |
| Texte secondaire     | #A6A6A6 | Lisibilité douce          |
| Bordures             | #272A2C | Délimitation subtile      |
| État OK              | #59E39A | Équipements online        |
| État Alerte          | #FF6B6B | Alertes / erreurs         |

---

## 🌤 **Mode Clair**

| Élément              | Couleur |
| -------------------- | ------- |
| Background principal | #F8FAFC |
| Surfaces (cards)     | #FFFFFF |
| Texte principal      | #1D1F21 |
| Texte secondaire     | #4E4E4E |
| Accents bleu-cyan    | #0FB6D8 |
| Alerte               | #FF5B5B |
| OK                   | #16C784 |

---

# 4. **ICONOGRAPHIE**

### Style :

* Outline
* Minimaliste
* Légèrement arrondi
* Pas de détails superflus
* Animation douce (pulsation + glissement)

### Forme des pictogrammes :

* Carrés et ronds **à angles doux (6px–10px)**
* Style “nano-modules” léger (petits points reliés)

---

# 5. **COMPAGNON IA**

### Style :

* Avatar simple + halo lumineux cyan
* Expression neutre et apaisante
* Très discret
* Apparait en bas à droite dans une bulle
* Pulsation douce pour montrer "activité"

### Fonction UX :

Une **suggestion intelligente** contextuelle par page
➡️ jamais intrusive
➡️ toujours compréhensible par un novice

---

# 6. **COMPOSANTS UI**

## 🌟 **Cards Scandinaves Futuristes**

* Fond : #1A1D1F (sombre) ou #FFFFFF (clair)
* Bords arrondis (10–14px)
* Ombres douces très légères
* Icons centrées + label en dessous
* Interaction :
  → Hover : halo cyan très doux (#2ACBEF55)
  → Press : léger “sink-in” (scale 0.98)

---

# 7. **NAVIGATION**

### Layout :

* Sidebar à gauche, permanente
* Icônes + label (pas d’icône seule)
* Sections compactes

### Structure minimale :

1. Dashboard
2. Appareils
3. Scènes
4. Historique
5. IA / Suggestions
6. Réglages

---

# 8. **DASHBOARD (Structure visuelle)**

**Header minimal :**

* Titre
* Avatar IA à droite

**Bloc 1 (haut) :**

* État général maison
* Petites cartes : température, présence, alarmes

**Bloc 2 (milieu) :**

* Scènes rapides (3–5 actions)

**Bloc 3 (bas) :**

* Liste équipements (tri auto)
* Indicateurs online/offline

---

# 9. **ANIMATIONS**

### Règles strictes :

* Jamais de mouvement rapide
* Doux, progressif, apaisant
* Durée 150–250ms
* Easing : `ease-out` ou `spring-light`

### Types :

* Pulsations très faibles
* Fade-in léger
* Glissement vertical très lent pour notifications

---

# 10. **TON & RÉDACTION**

### Style rédactionnel :

* Ultra simple
* Phrases courtes
* Aucun jargon technique
* Toujours expliquer l’action suivante

### Exemples :

❌ “Configurer un endpoint Zigbee2MQTT”
✔ “Ajouter un capteur”

❌ “Erreur lors de l’initialisation du device”
✔ “Le capteur ne répond pas. Essayez de le réveiller.”

---

# 11. **ACCESSIBILITÉ**

* Contraste AA minimum
* Taille texte min 15–16px
* Pictogrammes avec labels
* Indications visuelles + textuelles

---

# 12. **TON GÉNÉRAL DU SITE**

> *“Futuriste mais simple. Intelligent mais humain. Tech mais accessible.”*

---

