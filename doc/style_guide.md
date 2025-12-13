# 🧭 **Lumy Home — Guide UI & UX pour les développeurs**

## 🎨 **1. Identité visuelle**

### Style global : *Scandinave épuré*

* Ultra-sobre, calme, presque monochrome.
* Espaces blancs/vides assumés.
* Rare usage de couleurs vives (uniquement accents).
* Icônes minimalistes, outline, tailles uniformisées.

### Palette **Mode clair**

| Usage             | Couleur                                 |
| ----------------- | --------------------------------------- |
| Fond principal    | `#F7F7F5` (beige/gris clair scandinave) |
| Surfaces (cards)  | `#FFFFFF`                               |
| Texte principal   | `#1E1E1E`                               |
| Lignes/dividers   | `rgba(0,0,0,0.08)`                      |
| Accent            | `#86A6A0` (vert-gris nordique)          |
| Accent secondaire | `#D0BFAE` (bois clair)                  |

### Palette **Mode sombre**

| Usage             | Couleur                           |
| ----------------- | --------------------------------- |
| Fond principal    | `#1A1A1A` (anthracite scandinave) |
| Surfaces (cards)  | `#222222`                         |
| Texte principal   | `#EFEFEF`                         |
| Lignes/dividers   | `rgba(255,255,255,0.08)`          |
| Accent            | `#9BBEB7`                         |
| Accent secondaire | `#A68C78`                         |

### Typographie

* **Font principale :** "Inter" (équilibrée, moderne, lisible)
* Poids fréquents : 400 / 500 / 600
* Taille minimale texte : **14px** (novices)
* Titres : sobres, sans majuscules excessives

---

# 🧱 **2. Structure & Layout**

## **Navigation**

* **Sidebar fixe à gauche**, largeur : **240px**
* Icônes outline + labels visibles (jamais uniquement des icônes)
* Catégories compactes :

  * Dashboard
  * Équipements
  * Scènes
  * Historique
  * Paramètres
  * IA (section dédiée)

## **Header minimal**

* À droite : avatar de l’IA compagnon
* À gauche : titre de la page
* Sans ombres fortes, sans bordures.

## **Système de Cards scandinaves**

* Angles légèrement arrondis : **8px**
* Ombre extrêmement douce :

  ```css
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  ```
* Fond légèrement texturé :

  * clair : `#FFFFFF`
  * sombre : `#222222`

---

# 🤖 **3. IA compagnon (Lumy Home Assistant)**

### Style visuel

* Petite **mascotte scandinave stylisée** (avatar rond, simple)
* Plutôt abstraite qu’humaine (forme “goutte” ou “petite feuille”)
* Icône animée en **léger pouls** (scale 1.0 → 1.04)

### Position

* En bas à droite de chaque page
* Toujours accessible

### Interaction

* Popup avec :

  * Suggestion intelligente
  * Explication simple
  * Boutons clairs (“Activer”, “En savoir plus”, “Ignorer”)

---

# 🧩 **4. Composants & Patterns**

### **Cards de statut d’équipements**

Contenu :

* Icône outline (capteur, lampe…)
* Nom
* État principal (ON/OFF, °C, open/close…)
* Petit indicateur d’activité (pulsation douce si valeur récente)
* Click → détail de l’équipement

### **Graphiques de données**

* Placés en **haut** du dashboard
* Style ultra-minimal :

  * lignes fines
  * sans décorations inutiles
  * axes gris très pâles
* 1 ou 2 couleurs max

### **Listes simplifiées**

Pour novices :

* Police plus grande (16px)
* Texte clair, phrasing simple
* État coloré uniquement en accent

---

# 🧼 **5. Animation UX**

### Type d’animations :

* Douces, “organiques”
* Durée : **150–200ms**
* Exemple :

  * Fade-in pour cards
  * Slide léger pour ouverture de panneaux
  * Pulsation douce sur les icônes vivantes

### À éviter :

* Rebonds
* Survols flashy
* Animations trop longues

---

# 🧪 **6. Patterns d’interaction simplifiés (novices)**

### Règles UX essentielles :

* Aucun jargon technique
* Une seule action principale par écran
* Toujours expliquer les termes :
  *“Capteur Zigbee → Petit appareil sans fil utilisé pour mesurer quelque chose”*
* Page de détails très visuelle :

  * Valeur principale très grande (ex : température)
  * Petite description
  * Historique en dessous

---

# 📐 **7. Guidelines React + MUI**

### Theme MUI personnalisé

* Utiliser **ThemeProvider**
* Définir :

  * palette
  * typographie
  * radius 8px
  * composant “Card” customisé

### Composants à créer :

* `<ScandiCard />` → card épurée
* `<SidebarItem />`
* `<IAAvatar />`
* `<PulseIcon />`
* `<DashboardGrid />`
* `<EquipmentTile />`

### Layout conseillé :

```
<AppLayout>
  <Sidebar />
  <Header />
  <MainContent />
  <AIAssistant />
</AppLayout>
```

---

# 📄 **8. Exemples de règles à respecter**

### ✔ DO

* Beaucoup d’espace
* Couleurs sobres
* Icônes outline
* Texte simple
* Animations légères
* Graphiques minimalistes

### ❌ DON'T

* Pas d’ombres fortes
* Pas de couleurs saturées
* Pas de blocs denses
* Pas de 10 options sur un même écran
* Pas de typographies fantaisie

---

# 🎯 **9. Priorités UI pour la version MVP**

1. Sidebar stable + navigation simple
2. Dashboard :

   * Graphiques en haut
   * Liste d’équipements en bas
3. Page équipement (très simple)
4. Assistant IA fonctionnel
5. Mode clair/sombre natif MUI

---