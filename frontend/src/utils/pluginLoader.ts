import React, { ComponentType } from 'react';
import * as ReactDOM from 'react-dom';
import * as MaterialUI from '@mui/material';
import * as MaterialUIIcons from '@mui/icons-material';
import { PluginUIExtension } from '../services/plugins.service';

// Exposer React et les dépendances globalement pour les plugins
// Ces dépendances doivent être disponibles avant le chargement des plugins
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
  (window as any).MaterialUI = MaterialUI;
  (window as any).MaterialUIIcons = MaterialUIIcons;
  
  // Exposer Emotion pour les plugins qui en ont besoin
  try {
    // Utiliser dynamic import pour éviter les erreurs si Emotion n'est pas installé
    import('@emotion/react').then((emotionReact) => {
      (window as any).EmotionReact = emotionReact;
    }).catch(() => {
      (window as any).EmotionReact = {};
    });
    
    import('@emotion/styled').then((emotionStyled) => {
      (window as any).EmotionStyled = emotionStyled;
    }).catch(() => {
      (window as any).EmotionStyled = {};
    });
  } catch (e) {
    // Emotion n'est pas disponible
    (window as any).EmotionReact = {};
    (window as any).EmotionStyled = {};
  }
}

/**
 * Transforme les déclarations import ES6 en références aux modules globaux
 * Gère aussi les imports minifiés (sans espaces)
 */
function transformImports(code: string): string {
  let transformed = code;
  
  // Fonction helper pour obtenir le module global
  const getGlobalModule = (moduleName: string): string => {
    // Normaliser le nom du module (enlever les guillemets si présents)
    const normalized = moduleName.trim().replace(/^["']|["']$/g, '');
    if (normalized === 'react' || normalized === 'React') return 'window.React';
    if (normalized === 'react-dom' || normalized === 'ReactDOM') return 'window.ReactDOM';
    if (normalized === '@mui/material' || normalized === 'MaterialUI') return 'window.MaterialUI';
    if (normalized === '@mui/icons-material' || normalized === 'MaterialUIIcons') return 'window.MaterialUIIcons';
    if (normalized === '@emotion/react' || normalized === 'EmotionReact') return 'window.EmotionReact || {}';
    if (normalized === '@emotion/styled' || normalized === 'EmotionStyled') return 'window.EmotionStyled || {}';
    return '{}';
  };
  
  // Transformer import * as X from "module" (avec ou sans espaces, minifié ou non)
  // Pattern: import*as X from"module" ou import * as X from "module"
  // Gérer les cas où il n'y a AUCUN espace: import*as r from"React"
  // Pattern très permissif: import (0+ espaces) * (0+ espaces) as (1+ espaces) X (1+ espaces) from (0+ espaces) "module"
  // Utiliser un pattern global qui capture tout entre "import" et "from" puis le nom du module
  transformed = transformed.replace(
    /import\s*\*\s*as\s+(\w+)\s+from\s*["']([^"']+)["'];?\s*/g,
    (varName, moduleName) => {
      const globalModule = getGlobalModule(moduleName);
      return `const ${varName} = ${globalModule};\n`;
    }
  );
  
  // Pattern de secours pour les cas vraiment minifiés: import*asXfrom"module" (sans espaces du tout)
  // Ce pattern capture: import, puis *as, puis le nom de variable, puis from, puis le module
  // Note: Ce pattern est plus permissif et capture même sans espaces après "as"
  transformed = transformed.replace(
    /import\s*\*\s*as\s*(\w+)\s*from\s*["']([^"']+)["'];?\s*/g,
    (varName, moduleName) => {
      // Vérifier si cette transformation n'a pas déjà été faite
      if (!transformed.includes(`const ${varName} =`)) {
        const globalModule = getGlobalModule(moduleName);
        return `const ${varName} = ${globalModule};\n`;
      }
      return ''; // Supprimer l'import si déjà transformé
    }
  );
  
  // Transformer import X from "module" (avec ou sans espaces)
  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s*["']([^"']+)["'];?\s*/g,
    (varName, moduleName) => {
      const globalModule = getGlobalModule(moduleName);
      return `const ${varName} = ${globalModule}.default || ${globalModule};\n`;
    }
  );
  
  // Transformer import { X, Y } from "module" (avec ou sans espaces, minifié ou non)
  // Pattern: import{...}from"module" ou import { ... } from "module"
  transformed = transformed.replace(
    /import\s*{([^}]+)}\s*from\s*["']([^"']+)["'];?\s*/g,
    (imports, moduleName) => {
      const globalModule = getGlobalModule(moduleName);
      const importStatements: string[] = [];
      
      imports.split(',').forEach((imp: string) => {
        const trimmed = imp.trim();
        // Gérer les imports avec alias: X as Y
        const parts = trimmed.split(/\s+as\s+/);
        if (parts.length === 2) {
          // Import avec alias: créer const Y = Module.X
          const originalName = parts[0].trim();
          const aliasName = parts[1].trim();
          importStatements.push(`const ${aliasName} = ${globalModule}.${originalName};`);
        } else {
          // Import sans alias: créer const X = Module.X
          const name = trimmed;
          importStatements.push(`const ${name} = ${globalModule}.${name};`);
        }
      });
      
      return importStatements.join('\n') + '\n';
    }
  );
  
  // Transformer import X, { Y, Z } from "module" (avec ou sans espaces)
  transformed = transformed.replace(
    /import\s+(\w+)\s*,\s*{([^}]+)}\s+from\s*["']([^"']+)["'];?\s*/g,
    (defaultImport, namedImports, moduleName) => {
      const globalModule = getGlobalModule(moduleName);
      const importStatements: string[] = [];
      
      // Import par défaut
      importStatements.push(`const ${defaultImport} = ${globalModule}.default || ${globalModule};`);
      
      // Imports nommés
      namedImports.split(',').forEach((imp: string) => {
        const trimmed = imp.trim();
        const parts = trimmed.split(/\s+as\s+/);
        if (parts.length === 2) {
          const originalName = parts[0].trim();
          const aliasName = parts[1].trim();
          importStatements.push(`const ${aliasName} = ${globalModule}.${originalName};`);
        } else {
          const name = trimmed;
          importStatements.push(`const ${name} = ${globalModule}.${name};`);
        }
      });
      
      return importStatements.join('\n') + '\n';
    }
  );
  
  return transformed;
}

/**
 * Charge un composant de plugin depuis une URL et le transforme en module ES6
 * compatible avec React.lazy()
 */
async function loadPluginComponentCode(
  componentUrl: string,
  //extension: PluginUIExtension
): Promise<ComponentType<any>> {
  // Récupérer le token d'authentification
  const token = localStorage.getItem('lumy_token');
  
  // Charger le code depuis l'URL
  const response = await fetch(componentUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const originalCode = await response.text();
  let code = originalCode;

  // Vérifier si le code contient des imports ES6 non transformés (y compris minifiés)
  // Pattern pour détecter: import*as, import * as, import {, import X from
  const hasES6Imports = /import\s*\*?\s*as?\s*\w+\s+from\s*["']/.test(code) || 
                        /import\s+{/.test(code) || 
                        /import\s+\w+\s+from\s*["']/.test(code);
  
  // Vérifier les exports dans le code original (avant transformation)
  const hasES6Exports = /export\s+(default|{|\w+)/.test(originalCode);
  
  // Si le code contient des imports ES6, les transformer d'abord
  if (hasES6Imports) {
    code = transformImports(code);
    // Faire plusieurs passes pour s'assurer que tous les imports sont transformés
    let previousCode = '';
    let passes = 0;
    while (code !== previousCode && passes < 3) {
      previousCode = code;
      code = transformImports(code);
      passes++;
    }
  }

  // Détecter le format du module
  const isUMDBundle = 
    (code.trim().startsWith('!function') && code.includes('module.exports')) ||
    (code.trim().startsWith('(function') && code.includes('module.exports')) ||
    (code.includes('define.amd') && code.includes('module.exports'));
  
  // Un bundle UMD qui contient __webpack_require__ doit être traité comme un bundle webpack
  const isWebpackBundle = 
    (code.includes('__webpack_require__') || code.includes('/******/')) && 
    !(isUMDBundle && !code.includes('__webpack_require__'));
  
  // Si c'est un UMD avec webpack, le traiter comme webpack
  const isUMDWithWebpack = isUMDBundle && code.includes('__webpack_require__');
  
  // Détecter les modules ES6 (avec imports et/ou exports, même minifiés)
  // Utiliser le code original pour détecter les exports (car ils peuvent être transformés)
  const isES6Module = (hasES6Imports || hasES6Exports) && !isWebpackBundle && !isUMDBundle;
  
  const isCommonJS = code.includes('module.exports') && !isWebpackBundle && !isUMDBundle;

  let componentFactory: any;

  if (isUMDWithWebpack) {
    // Pour les bundles UMD avec webpack, utiliser un loader spécialisé
    componentFactory = await loadUMDWebpackBundle(code);
  } else if (isWebpackBundle) {
    // Pour les bundles webpack purs, utiliser le loader webpack
    componentFactory = await loadWebpackBundle(code);
  } else if (isUMDBundle) {
    // Pour les bundles UMD purs, créer un wrapper qui expose le composant
    componentFactory = await loadUMDBundle(code);
  } else if (isWebpackBundle) {
    // Pour les bundles webpack, créer un wrapper qui expose le composant
    componentFactory = await loadWebpackBundle(code);
  } else if (isES6Module) {
    // Pour les modules ES6, créer un wrapper qui expose le composant
    componentFactory = await loadES6Module(code);
  } else if (isCommonJS) {
    // Pour CommonJS, créer un wrapper qui expose le composant
    componentFactory = await loadCommonJSModule(code);
  } else {
    // Format inconnu, essayer de l'exécuter directement
    componentFactory = await loadUnknownFormat(code);
  }

  // Extraire le composant
  if (typeof componentFactory === 'function') {
    return componentFactory;
  } else if (componentFactory && typeof componentFactory.default === 'function') {
    return componentFactory.default;
  } else if (componentFactory && typeof componentFactory === 'object') {
    // Chercher une propriété qui est une fonction React
    const funcKeys = Object.keys(componentFactory).filter(
      key => typeof componentFactory[key] === 'function'
    );
    if (funcKeys.length > 0) {
      return componentFactory[funcKeys[0]];
    }
  }

  throw new Error('Le composant exporté n\'est pas une fonction React valide');
}

/**
 * Charge un bundle UMD
 */
async function loadUMDBundle(code: string): Promise<any> {
  const exports: any = {};
  const module: any = { exports: exports };
  
  // Simuler require pour les dépendances externes
  const require = function(name: string) {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'react' || name === 'React') return window.React;
    if (normalizedName === 'react-dom' || name === 'ReactDOM') return window.ReactDOM;
    if (normalizedName === '@mui/material' || name === 'MaterialUI') return window.MaterialUI;
    if (normalizedName === '@mui/icons-material' || name === 'MaterialUIIcons') return window.MaterialUIIcons;
    if (normalizedName === '@emotion/react' || name === 'EmotionReact') return window.EmotionReact || {};
    if (normalizedName === '@emotion/styled' || name === 'EmotionStyled') return window.EmotionStyled || {};
    throw new Error('Module non disponible: ' + name);
  };
  
  // Simuler define pour AMD
  const define = function(deps: any, factory?: any) {
    if (typeof deps === 'function') {
      factory = deps;
      deps = [];
    }
    const resolvedDeps = deps.map((dep: string) => require(dep));
    const result = factory.apply(null, resolvedDeps);
    if (result !== undefined) {
      module.exports = result;
    }
  };
  (define as any).amd = true;
  
  // Créer un objet root avec les dépendances pour le bundle UMD
  // Inclure les variantes avec majuscules/minuscules pour compatibilité
  const rootObj: any = {
    react: window.React,
    React: window.React,
    'react-dom': window.ReactDOM,
    ReactDOM: window.ReactDOM,
    '@mui/material': window.MaterialUI,
    MaterialUI: window.MaterialUI,
    '@mui/icons-material': window.MaterialUIIcons,
    MaterialUIIcons: window.MaterialUIIcons,
    '@emotion/react': window.EmotionReact || {},
    EmotionReact: window.EmotionReact || {},
    '@emotion/styled': window.EmotionStyled || {},
    EmotionStyled: window.EmotionStyled || {},
  };
  
  // Exécuter le bundle UMD
  const umdWrapperCode = `
    (function() {
      const self = this;
      self.react = arguments[0].react;
      self['react-dom'] = arguments[0]['react-dom'];
      self['@mui/material'] = arguments[0]['@mui/material'];
      self['@mui/icons-material'] = arguments[0]['@mui/icons-material'];
      self['@emotion/react'] = arguments[0]['@emotion/react'];
      self['@emotion/styled'] = arguments[0]['@emotion/styled'];
      
      const exports = arguments[1];
      const module = arguments[2];
      const require = arguments[3];
      const define = arguments[4];
      
      ${code}
      
      return module.exports !== exports ? module.exports : exports;
    })
  `;
  
  // eslint-disable-next-line no-eval
  const umdWrapper = eval(umdWrapperCode);
  const umdResult = umdWrapper.call(rootObj, rootObj, exports, module, require, define);
  
  // Extraire le composant du résultat
  if (umdResult) {
    return umdResult.default || umdResult;
  } else if (module.exports && module.exports !== exports) {
    return module.exports.default || module.exports;
  } else if (exports.default) {
    return exports.default;
  } else if (Object.keys(exports).length > 0) {
    return exports;
  } else {
    // Vérifier rootObj pour les exports globaux
    const possibleExports = ['default', 'widget', 'Widget', 'ControlWidget'];
    for (const key of possibleExports) {
      if (rootObj[key] && typeof rootObj[key] === 'function') {
        return rootObj[key];
      }
    }
  }
  
  throw new Error('Impossible d\'extraire le composant du bundle UMD');
}

/**
 * Charge un bundle UMD qui contient du code webpack
 */
async function loadUMDWebpackBundle(code: string): Promise<any> {
  // Simuler require pour les dépendances externes (avec majuscules/minuscules)
  const require = function(name: string) {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'react' || name === 'React') return window.React;
    if (normalizedName === 'react-dom' || name === 'ReactDOM') return window.ReactDOM;
    if (normalizedName === '@mui/material' || name === 'MaterialUI') return window.MaterialUI;
    if (normalizedName === '@mui/icons-material' || name === 'MaterialUIIcons') return window.MaterialUIIcons;
    if (normalizedName === '@emotion/react' || name === 'EmotionReact') return window.EmotionReact || {};
    if (normalizedName === '@emotion/styled' || name === 'EmotionStyled') return window.EmotionStyled || {};
    throw new Error('Module non disponible: ' + name);
  };
  
  // Simuler define pour AMD
  const define = function(deps: any, factory?: any) {
    if (typeof deps === 'function') {
      factory = deps;
      deps = [];
    }
    const resolvedDeps = deps.map((dep: string) => require(dep));
    const result = factory.apply(null, resolvedDeps);
    if (result !== undefined) {
      return result;
    }
  };
  (define as any).amd = true;
  
  // Créer un objet root avec les dépendances (avec majuscules pour compatibilité)
  const rootObj: any = {
    React: window.React,
    react: window.React,
    ReactDOM: window.ReactDOM,
    'react-dom': window.ReactDOM,
    MaterialUI: window.MaterialUI,
    '@mui/material': window.MaterialUI,
    MaterialUIIcons: window.MaterialUIIcons,
    '@mui/icons-material': window.MaterialUIIcons,
    EmotionReact: window.EmotionReact || {},
    '@emotion/react': window.EmotionReact || {},
    EmotionStyled: window.EmotionStyled || {},
    '@emotion/styled': window.EmotionStyled || {},
  };
  
  const exports: any = {};
  const module: any = { exports: exports };
  
  // Exécuter le code UMD directement
  // Le wrapper UMD est une IIFE: (function(root, factory) { ... })(this, factory)
  // Il détecte l'environnement et appelle la factory avec les dépendances
  try {
    // Créer un contexte d'exécution avec exports, module, require, define
    const executionContext = `
      (function() {
        'use strict';
        const exports = {};
        const module = { exports: exports };
        const require = ${require.toString()};
        const define = ${define.toString()};
        define.amd = true;
        
        // Exposer sur this pour que le wrapper UMD puisse les utiliser
        this.exports = exports;
        this.module = module;
        this.require = require;
        this.define = define;
        
        // Exposer les dépendances sur rootObj
        const root = this;
        root.React = window.React;
        root.MaterialUI = window.MaterialUI;
        root.MaterialUIIcons = window.MaterialUIIcons;
        
        // Exécuter le code UMD
        ${code}
        
        // Retourner le résultat
        return module.exports !== exports ? module.exports : exports;
      })
    `;
    
    // eslint-disable-next-line no-eval
    const umdResult = eval(executionContext).call(rootObj);
    
    // Le résultat devrait être le code webpack exécuté qui retourne __webpack_exports__
    // Extraire le composant du résultat
    if (umdResult && typeof umdResult.default === 'function') {
      return umdResult.default;
    }
    if (umdResult && typeof umdResult === 'function') {
      return umdResult;
    }
    if (module.exports && typeof module.exports.default === 'function') {
      return module.exports.default;
    }
    if (module.exports && typeof module.exports === 'function') {
      return module.exports;
    }
    if (exports && typeof exports.default === 'function') {
      return exports.default;
    }
    
    // Chercher dans rootObj pour les exports globaux
    const possibleExports = ['default', 'settings', 'Settings', 'TelegramSettings', 'widget', 'Widget'];
    for (const key of possibleExports) {
      if (rootObj[key] && typeof rootObj[key] === 'function') {
        return rootObj[key];
      }
    }
    
    // Si le résultat est un objet, chercher une fonction dedans
    if (umdResult && typeof umdResult === 'object') {
      const funcKeys = Object.keys(umdResult).filter(
        key => typeof umdResult[key] === 'function'
      );
      if (funcKeys.length > 0) {
        return umdResult[funcKeys[0]];
      }
    }
    
    throw new Error('Impossible d\'extraire le composant du bundle UMD-Webpack');
  } catch (error: any) {
    console.error('Erreur lors du chargement du bundle UMD-Webpack:', error);
    console.error('Code (premiers 500 caractères):', code.substring(0, 500));
    // Essayer de charger comme un bundle webpack normal
    return await loadWebpackBundle(code);
  }
}

/**
 * Charge un bundle webpack
 */
async function loadWebpackBundle(code: string): Promise<any> {
  // Transformer les exports ES6 en assignments avant l'exécution
  let transformedCode = code;
  
  // Remplacer les imports ES6 natifs par des références aux modules globaux
  transformedCode = transformedCode.replace(
    /^import\s+\*\s+as\s+(__WEBPACK_EXTERNAL_MODULE__[a-zA-Z0-9_]+)\s+from\s+["']([^"']+)["'];?\s*$/gm,
    (varName, moduleName) => {
      if (moduleName === 'react') {
        return `const ${varName} = window.React;`;
      }
      if (moduleName === 'react-dom') {
        return `const ${varName} = window.ReactDOM;`;
      }
      if (moduleName === '@mui/material') {
        return `const ${varName} = window.MaterialUI;`;
      }
      if (moduleName === '@mui/icons-material') {
        return `const ${varName} = window.MaterialUIIcons;`;
      }
      if (moduleName === '@emotion/react') {
        return `const ${varName} = window.EmotionReact || {};`;
      }
      if (moduleName === '@emotion/styled') {
        return `const ${varName} = window.EmotionStyled || {};`;
      }
      return `const ${varName} = {};`;
    }
  );
  
  // Remplacer les exports ES6 par des assignments CommonJS
  transformedCode = transformedCode.replace(
    /export\s+{\s*__webpack_exports__default\s+as\s+default\s*};/g,
    '__webpack_exports__default = __webpack_exports__default || __webpack_exports__.default;'
  );
  
  // Créer un contexte d'exécution isolé
  const webpackRuntime = `
    (function() {
      'use strict';
      
      const React = window.React;
      const ReactDOM = window.ReactDOM;
      const MaterialUI = window.MaterialUI;
      const MaterialUIIcons = window.MaterialUIIcons;
      const EmotionReact = window.EmotionReact || {};
      const EmotionStyled = window.EmotionStyled || {};
      
      // Simuler __webpack_require__
      const __webpack_modules__ = {};
      const __webpack_module_cache__ = {};
      
      const __webpack_require__ = function(moduleId) {
        if (__webpack_module_cache__[moduleId]) {
          return __webpack_module_cache__[moduleId].exports;
        }
        
        const module = { exports: {} };
        __webpack_module_cache__[moduleId] = module;
        
        if (moduleId === 'react' || (moduleId.includes('react') && !moduleId.includes('@'))) {
          return React;
        }
        if (moduleId === 'react-dom' || moduleId.includes('react-dom')) {
          return ReactDOM;
        }
        if (moduleId.includes('@mui/material')) {
          return MaterialUI;
        }
        if (moduleId.includes('@mui/icons-material')) {
          return MaterialUIIcons;
        }
        if (moduleId.includes('@emotion/react')) {
          return EmotionReact;
        }
        if (moduleId.includes('@emotion/styled')) {
          return EmotionStyled;
        }
        
        if (__webpack_modules__[moduleId]) {
          __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
        }
        
        return module.exports;
      };
      
      __webpack_require__.r = function(exports) {
        if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
          Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
        }
        Object.defineProperty(exports, '__esModule', { value: true });
      };
      
      __webpack_require__.d = function(exports, definition) {
        for (var key in definition) {
          if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
          }
        }
      };
      
      __webpack_require__.o = function(object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
      };
      
      var __webpack_exports__ = {};
      var __webpack_exports__default = null;
      
      ${transformedCode}
      
      var moduleExports = null;
      try {
        if (typeof module !== 'undefined' && module.exports) {
          moduleExports = module.exports;
        }
      } catch (e) {
        // module n'est pas disponible
      }
      
      if (typeof __webpack_exports__default !== 'undefined' && __webpack_exports__default !== null) {
        return __webpack_exports__default;
      }
      if (moduleExports && moduleExports.default) {
        return moduleExports.default;
      }
      if (moduleExports && typeof moduleExports === 'function') {
        return moduleExports;
      }
      if (typeof __webpack_exports__ !== 'undefined' && __webpack_exports__.default) {
        return __webpack_exports__.default;
      }
      if (typeof __webpack_exports__ !== 'undefined' && Object.keys(__webpack_exports__).length > 0) {
        return __webpack_exports__;
      }
      if (moduleExports && typeof moduleExports === 'object' && Object.keys(moduleExports).length > 0) {
        return moduleExports;
      }
      
      return null;
    })();
  `;
  
  // eslint-disable-next-line no-eval
  return eval(webpackRuntime);
}

/**
 * Charge un module ES6
 */
async function loadES6Module(code: string): Promise<any> {
  console.log('[loadES6Module] Code original (premiers 200 caractères):', code.substring(0, 200));
  
  // Transformer les imports ES6 avant l'exécution (plusieurs passes pour gérer les cas minifiés)
  let transformedCode = transformImports(code);
  console.log('[loadES6Module] Après première transformation (premiers 200 caractères):', transformedCode.substring(0, 200));
  
  // Faire plusieurs passes pour s'assurer que tous les imports sont transformés
  let previousCode = '';
  let passes = 0;
  const maxPasses = 10;
  while (transformedCode !== previousCode && passes < maxPasses) {
    previousCode = transformedCode;
    transformedCode = transformImports(transformedCode);
    passes++;
    if (passes <= 3) {
      console.log(`[loadES6Module] Après passe ${passes} (premiers 200 caractères):`, transformedCode.substring(0, 200));
    }
  }
  
  if (passes >= maxPasses) {
    console.warn('[loadES6Module] Nombre maximum de passes atteint pour la transformation des imports');
  }
  
  // Vérifier qu'il ne reste plus d'imports (sécurité) - gérer aussi les imports minifiés
  // Pattern très permissif pour détecter TOUS les types d'imports possibles
  const importPatterns = [
    /import\s*\*\s*as\s+\w+\s+from\s*["'][^"']+["'];?/g,  // import*as X from"module"
    /import\s*{([^}]+)}\s*from\s*["'][^"']+["'];?/g,      // import{...}from"module"
    /import\s+\w+\s+from\s*["'][^"']+["'];?/g,            // import X from"module"
  ];
  
  let hasRemainingImports = false;
  for (const pattern of importPatterns) {
    const matches = transformedCode.match(pattern);
    if (matches && matches.length > 0) {
      hasRemainingImports = true;
      console.warn('Imports ES6 restants détectés:', matches);
      break;
    }
  }
  
  if (hasRemainingImports) {
    // Essayer une dernière transformation
    transformedCode = transformImports(transformedCode);
    
    // Si des imports restent encore, les supprimer complètement avec des patterns très agressifs
    for (const pattern of importPatterns) {
      const stillRemaining = transformedCode.match(pattern);
      if (stillRemaining && stillRemaining.length > 0) {
        console.warn('Suppression forcée des imports ES6:', stillRemaining);
        // Supprimer tous les types d'imports possibles
        transformedCode = transformedCode.replace(pattern, '');
      }
    }
    
    // Patterns de secours pour supprimer tout ce qui ressemble à un import
    transformedCode = transformedCode.replace(/^import[^;]*;?\s*$/gm, '');
    transformedCode = transformedCode.replace(/import[^;]*;?\s*/g, '');
  }
  
  // Transformer les exports ES6 en assignments CommonJS
  let finalCode = transformedCode;
  
  // Transformer export default X (avec ou sans espaces, minifié ou non)
  finalCode = finalCode.replace(
    /export\s+default\s+([^;]+);?/g,
    'exports.default = $1;'
  );
  
  // Transformer export { X, Y } ou export{X,Y} (avec ou sans espaces, minifié ou non)
  finalCode = finalCode.replace(
    /export\s*{\s*([^}]+)\s*};?/g,
    (exportsList) => {
      const exports = exportsList.split(',').map((exp: string) => {
        // Gérer les exports avec alias: X as Y (même minifié: X as Y)
        const parts = exp.trim().split(/\s+as\s+/);
        if (parts.length === 2) {
          return `exports.${parts[1].trim()} = ${parts[0].trim()};`;
        }
        return `exports.${parts[0].trim()} = ${parts[0].trim()};`;
      });
      return exports.join('\n');
    }
  );
  
  // Transformer export const/function/class
  finalCode = finalCode.replace(
    /export\s+(const|let|var|function|class)\s+(\w+)/g,
    '$1 $2'
  );
  
  // Vérification finale : s'assurer qu'il n'y a plus d'imports avant l'exécution
  // Si des imports restent, cela causera une erreur de syntaxe
  const finalImportCheck = /import\s*\*?\s*as?\s*\w+\s+from\s*["']/.test(finalCode) || 
                           /import\s*{/.test(finalCode) ||
                           /import\s*\*\s*as/.test(finalCode);
  if (finalImportCheck) {
    console.error('[loadES6Module] ATTENTION: Des imports ES6 sont encore présents dans le code avant l\'exécution!');
    console.error('[loadES6Module] Code problématique (premiers 1000 caractères):', finalCode.substring(0, 1000));
    // Supprimer tous les imports restants de manière très agressive
    // Pattern 1: import*as X from"module" ou import * as X from "module"
    finalCode = finalCode.replace(/import\s*\*\s*as\s*\w+\s*from\s*["'][^"']+["'];?\s*/g, '');
    // Pattern 2: import{...}from"module"
    finalCode = finalCode.replace(/import\s*{[^}]*}\s*from\s*["'][^"']+["'];?\s*/g, '');
    // Pattern 3: import X from"module"
    finalCode = finalCode.replace(/import\s+\w+\s+from\s*["'][^"']+["'];?\s*/g, '');
    // Pattern 4: Tout ce qui commence par "import" jusqu'au prochain point-virgule ou fin de ligne
    finalCode = finalCode.replace(/import[^;]*;?\s*/g, '');
    console.log('[loadES6Module] Code après suppression agressive (premiers 200 caractères):', finalCode.substring(0, 200));
  }
  
  // Échapper le code pour éviter les problèmes avec les backticks et autres caractères spéciaux
  // Remplacer les backticks par des caractères échappés
  const escapedCode = finalCode.replace(/`/g, '\\`').replace(/\${/g, '\\${');
  
  // Construire le wrapper en utilisant une fonction pour éviter les problèmes de template literal
  const moduleWrapper = [
    '(function() {',
    "  'use strict';",
    '  const React = window.React;',
    '  const exports = {};',
    '  const module = { exports };',
    '  ',
    '  const require = function(name) {',
    "    if (name === 'react') return React;",
    "    if (name === 'react-dom') return window.ReactDOM || null;",
    "    if (name === '@mui/material') return window.MaterialUI || null;",
    "    if (name === '@mui/icons-material') return window.MaterialUIIcons || null;",
    "    if (name === '@emotion/react') return window.EmotionReact || {};",
    "    if (name === '@emotion/styled') return window.EmotionStyled || {};",
    "    throw new Error('Module non disponible: ' + name);",
    '  };',
    '  ',
    '  try {',
    escapedCode,
    '  } catch (e) {',
    "    console.error('Erreur lors de l\\'exécution du module ES6:', e);",
    "    console.error('Code transformé (premiers 500 caractères):', " + JSON.stringify(finalCode.substring(0, 500)) + ");",
    '    throw e;',
    '  }',
    '  ',
    '  if (typeof exports.default !== "undefined") {',
    '    return exports.default;',
    '  }',
    '  if (typeof module.exports !== "undefined" && module.exports !== exports) {',
    '    return module.exports.default || module.exports;',
    '  }',
    '  return exports;',
    '})();'
  ].join('\n');
  
  // Utiliser eval au lieu de new Function pour gérer les imports transformés
  // eslint-disable-next-line no-eval
  return eval(moduleWrapper);
}

/**
 * Charge un module CommonJS
 */
async function loadCommonJSModule(code: string): Promise<any> {
  // Transformer les imports ES6 s'il y en a dans le code CommonJS
  let transformedCode = transformImports(code);
  
  // Transformer aussi les exports ES6 au cas où
  transformedCode = transformExports(transformedCode);
  
  // Vérifier qu'il ne reste plus d'imports ou d'exports
  if (/^import\s+.*from\s+["']/.test(transformedCode) || /import\s+.*from\s+["']/m.test(transformedCode)) {
    transformedCode = transformedCode.replace(/^import\s+.*from\s+["'][^"']+["'];?\s*$/gm, '');
    transformedCode = transformedCode.replace(/import\s+.*from\s+["'][^"']+["'];?\s*/g, '');
  }
  
  if (/^export\s+/.test(transformedCode) || /export\s+/m.test(transformedCode)) {
    transformedCode = transformedCode.replace(/^export\s+[^;]*;?\s*$/gm, '');
    transformedCode = transformedCode.replace(/export\s+[^;]*;?\s*/g, '');
  }
  
  // Échapper le code pour éviter les problèmes avec les backticks et autres caractères spéciaux
  const escapedCode = transformedCode.replace(/`/g, '\\`').replace(/\${/g, '\\${');
  
  const moduleWrapper = [
    '(function() {',
    "  'use strict';",
    '  const React = window.React;',
    '  const exports = {};',
    '  const module = { exports };',
    '  ',
    '  const require = function(name) {',
    "    if (name === 'react') return React;",
    "    if (name === 'react-dom') return window.ReactDOM || null;",
    "    if (name === '@mui/material') return window.MaterialUI || null;",
    "    if (name === '@mui/icons-material') return window.MaterialUIIcons || null;",
    "    if (name === '@emotion/react') return window.EmotionReact || {};",
    "    if (name === '@emotion/styled') return window.EmotionStyled || {};",
    "    throw new Error('Module non disponible: ' + name);",
    '  };',
    '  ',
    '  try {',
    escapedCode,
    '  } catch (e) {',
    "    console.error('Erreur lors de l\\'exécution du module CommonJS:', e);",
    "    console.error('Code transformé (premiers 500 caractères):', " + JSON.stringify(transformedCode.substring(0, 500)) + ");",
    '    throw e;',
    '  }',
    '  ',
    '  return module.exports || exports.default || exports;',
    '})();'
  ].join('\n');
  
  // Utiliser eval au lieu de new Function pour gérer les imports transformés
  // eslint-disable-next-line no-eval
  return eval(moduleWrapper);
}

/**
 * Transforme les exports ES6 en assignments CommonJS
 */
function transformExports(code: string): string {
  let transformed = code;
  
  // Transformer export default X
  transformed = transformed.replace(
    /export\s+default\s+([^;]+);?/g,
    'exports.default = $1;'
  );
  
  // Transformer export { X, Y } ou export{X,Y}
  transformed = transformed.replace(
    /export\s*{\s*([^}]+)\s*};?/g,
    (exportsList) => {
      const exports = exportsList.split(',').map((exp: string) => {
        const parts = exp.trim().split(/\s+as\s+/);
        if (parts.length === 2) {
          return `exports.${parts[1].trim()} = ${parts[0].trim()};`;
        }
        return `exports.${exp.trim()} = ${exp.trim()};`;
      });
      return exports.join('\n');
    }
  );
  
  // Transformer export const/let/var/function/class
  transformed = transformed.replace(
    /export\s+(const|let|var|function|class)\s+(\w+)/g,
    '$1 $2'
  );
  
  // Supprimer les exports restants qui n'ont pas été transformés
  transformed = transformed.replace(/export\s+[^;]*;?\s*/g, '');
  
  return transformed;
}

/**
 * Charge un format inconnu
 */
async function loadUnknownFormat(code: string): Promise<any> {
  // Transformer les imports ES6 s'il y en a
  let transformedCode = transformImports(code);
  
  // Transformer les exports ES6 en assignments CommonJS
  transformedCode = transformExports(transformedCode);
  
  // Vérifier qu'il ne reste plus d'imports (sécurité)
  if (/^import\s+.*from\s+["']/.test(transformedCode) || /import\s+.*from\s+["']/m.test(transformedCode)) {
    // Si des imports restent, les supprimer complètement
    transformedCode = transformedCode.replace(/^import\s+.*from\s+["'][^"']+["'];?\s*$/gm, '');
    transformedCode = transformedCode.replace(/import\s+.*from\s+["'][^"']+["'];?\s*/g, '');
  }
  
  // Vérifier qu'il ne reste plus d'exports (sécurité)
  if (/^export\s+/.test(transformedCode) || /export\s+/m.test(transformedCode)) {
    // Si des exports restent, les supprimer complètement
    transformedCode = transformedCode.replace(/^export\s+[^;]*;?\s*$/gm, '');
    transformedCode = transformedCode.replace(/export\s+[^;]*;?\s*/g, '');
  }
  
  // Supprimer aussi les fragments "as" isolés qui pourraient rester
  transformedCode = transformedCode.replace(/\s+as\s+\w+\s*[,}]/g, '');
  
  // Échapper le code pour éviter les problèmes avec les backticks et autres caractères spéciaux
  const escapedCode = transformedCode.replace(/`/g, '\\`').replace(/\${/g, '\\${');
  
  const moduleWrapper = [
    '(function() {',
    "  'use strict';",
    '  const React = window.React;',
    '  const exports = {};',
    '  const module = { exports };',
    '  ',
    '  const require = function(name) {',
    "    if (name === 'react') return React;",
    "    if (name === 'react-dom') return window.ReactDOM || null;",
    "    if (name === '@mui/material') return window.MaterialUI || null;",
    "    if (name === '@mui/icons-material') return window.MaterialUIIcons || null;",
    "    if (name === '@emotion/react') return window.EmotionReact || {};",
    "    if (name === '@emotion/styled') return window.EmotionStyled || {};",
    "    throw new Error('Module non disponible: ' + name);",
    '  };',
    '  ',
    '  try {',
    escapedCode,
    '  } catch (e) {',
    "    console.error('Erreur lors de l\\'exécution du format inconnu:', e);",
    "    console.error('Code transformé (premiers 500 caractères):', " + JSON.stringify(transformedCode.substring(0, 500)) + ");",
    '    throw e;',
    '  }',
    '  ',
    '  return module.exports || exports.default || exports;',
    '})();'
  ].join('\n');
  
  // Utiliser eval au lieu de new Function pour gérer les imports transformés
  // eslint-disable-next-line no-eval
  return eval(moduleWrapper);
}

/**
 * Crée une fonction de chargement pour React.lazy()
 * Cette fonction charge le composant depuis l'URL et le transforme en module ES6
 */
export function createPluginLoader(extension: PluginUIExtension): () => Promise<{ default: ComponentType<any> }> {
  return async () => {
    if (!extension.componentPath) {
      throw new Error('Chemin du composant non défini');
    }

    // Construire l'URL du composant depuis le backend
    const pluginId = extension.pluginId;
    // Normaliser le chemin du composant (enlever ./ au début si présent)
    const normalizedPath = extension.componentPath.startsWith('./') 
      ? extension.componentPath.substring(2) 
      : extension.componentPath.startsWith('/') 
        ? extension.componentPath.substring(1)
        : extension.componentPath;
    
    // Utiliser la même logique que apiService pour construire l'URL
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const endpoint = `/plugins/${pluginId}/static/${normalizedPath}`;
    const componentUrl = API_BASE_URL.startsWith('http') 
      ? `${API_BASE_URL}${endpoint}` 
      : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    try {
      const Component = await loadPluginComponentCode(componentUrl);
      
      // Retourner le composant dans un format compatible avec React.lazy()
      return { default: Component };
    } catch (error: any) {
      console.error('Erreur lors du chargement du composant du plugin:', error);
      
      // Retourner un composant d'erreur par défaut
      return {
        default: () => {
          // Utiliser les modules globaux au lieu de require
          const MaterialUI = (window as any).MaterialUI || {};
          const Box = MaterialUI.Box || (() => null);
          const Typography = MaterialUI.Typography || (() => null);
          const Alert = MaterialUI.Alert || (() => null);
          
          return React.createElement(
            Box,
            { sx: { p: 3 } },
            React.createElement(
              Typography,
              { variant: 'h4', gutterBottom: true },
              extension.displayName
            ),
            extension.description && React.createElement(
              Typography,
              { variant: 'body1', color: 'text.secondary', paragraph: true },
              extension.description
            ),
            React.createElement(
              Alert,
              { severity: 'error' },
              React.createElement(
                Typography,
                { variant: 'body2', gutterBottom: true },
                React.createElement('strong', null, 'Plugin:'),
                ' ',
                extension.name
              ),
              React.createElement(
                Typography,
                { variant: 'body2', gutterBottom: true },
                React.createElement('strong', null, 'Composant:'),
                ' ',
                extension.componentPath
              ),
              React.createElement(
                Typography,
                { variant: 'body2', sx: { mt: 1 } },
                'Erreur lors du chargement du composant: ',
                error.message || 'Erreur inconnue'
              )
            )
          );
        },
      };
    }
  };
}

