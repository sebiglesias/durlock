(() => {
  'use strict';

  // State
  const state = {
    mode: 'tabique', // 'tabique' | 'revestimiento' | 'cielorraso'
    largo: 4.0,
    alto: 2.6,
    openingsM2: 0.0,
    spacing: 0.48, // 0.40 or 0.48 m
    plateType: 'std',
    wastePct: 0.10,
    insulation: true,
    savedItems: []
  };

  // Plate metadata
  const PLATE_NAMES = {
    std: 'Placa Durlock Estándar 12.5mm (Blanca)',
    rh: 'Placa Durlock Antihumedad RH 12.5mm (Verde)',
    rf: 'Placa Durlock Ignífuga RF 12.5mm (Roja)',
    cie: 'Placa Durlock Cielorraso 9.5mm'
  };

  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const inputLargo = document.getElementById('inputLargo');
  const inputAlto = document.getElementById('inputAlto');
  const labelLargo = document.getElementById('labelLargo');
  const labelAlto = document.getElementById('labelAlto');
  const inputOpenings = document.getElementById('inputOpenings');
  const selectSpacing = document.getElementById('selectSpacing');
  const selectPlate = document.getElementById('selectPlate');
  const selectWaste = document.getElementById('selectWaste');
  const checkInsulation = document.getElementById('checkInsulation');
  const presetChips = document.querySelectorAll('.preset-chip');
  const themeToggle = document.getElementById('themeToggle');
  const toast = document.getElementById('toast');

  // Metrics elements
  const metricStructureArea = document.getElementById('metricStructureArea');
  const metricPlatesArea = document.getElementById('metricPlatesArea');
  const metricPlatesCount = document.getElementById('metricPlatesCount');
  const materialsListEl = document.getElementById('materialsList');

  // Initialize
  function init() {
    loadTheme();
    loadSavedItems();
    attachEvents();
    recalculate();
  }

  function attachEvents() {
    // Mode Switch
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.mode = tab.dataset.mode;
        updateLabelsForMode();
        recalculate();
      });
    });

    // Inputs
    inputLargo.addEventListener('input', (e) => {
      state.largo = Math.max(0.1, parseFloat(e.target.value) || 0.1);
      recalculate();
    });
    inputAlto.addEventListener('input', (e) => {
      state.alto = Math.max(0.1, parseFloat(e.target.value) || 0.1);
      recalculate();
    });
    inputOpenings.addEventListener('input', (e) => {
      state.openingsM2 = Math.max(0, parseFloat(e.target.value) || 0);
      recalculate();
    });

    // Step buttons (+ / -)
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const step = parseFloat(btn.dataset.step);
        const input = document.getElementById(targetId);
        let val = (parseFloat(input.value) || 0) + step;
        if (targetId === 'inputOpenings') {
          val = Math.max(0, parseFloat(val.toFixed(2)));
        } else {
          val = Math.max(0.5, parseFloat(val.toFixed(2)));
        }
        input.value = val;
        input.dispatchEvent(new Event('input'));
      });
    });

    // Selects
    selectSpacing.addEventListener('change', (e) => {
      state.spacing = parseFloat(e.target.value);
      recalculate();
    });
    selectPlate.addEventListener('change', (e) => {
      state.plateType = e.target.value;
      recalculate();
    });
    selectWaste.addEventListener('change', (e) => {
      state.wastePct = parseFloat(e.target.value);
      recalculate();
    });
    checkInsulation.addEventListener('change', (e) => {
      state.insulation = e.target.checked;
      recalculate();
    });

    // Presets
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const mode = chip.dataset.mode;
        const largo = parseFloat(chip.dataset.largo);
        const alto = parseFloat(chip.dataset.alto);
        const plate = chip.dataset.plate || 'std';

        // Switch tab
        tabs.forEach(t => {
          if (t.dataset.mode === mode) t.click();
        });

        state.largo = largo;
        state.alto = alto;
        state.plateType = plate;
        inputLargo.value = largo;
        inputAlto.value = alto;
        selectPlate.value = plate;
        recalculate();
      });
    });

    // Theme Toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Actions
    document.getElementById('btnCopyWhatsApp').addEventListener('click', copyForWhatsApp);
    document.getElementById('btnPrintBudget').addEventListener('click', () => window.print());
    document.getElementById('btnSaveRoom').addEventListener('click', saveCurrentRoom);

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        item.classList.toggle('active');
      });
    });
  }

  function updateLabelsForMode() {
    if (state.mode === 'cielorraso') {
      labelLargo.innerHTML = '<span>Largo de la habitación</span><span class="input-unit">metros</span>';
      labelAlto.innerHTML = '<span>Ancho de la habitación</span><span class="input-unit">metros</span>';
      selectPlate.value = 'cie';
      state.plateType = 'cie';
    } else {
      labelLargo.innerHTML = '<span>Largo de la pared</span><span class="input-unit">metros</span>';
      labelAlto.innerHTML = '<span>Altura de la pared</span><span class="input-unit">metros</span>';
      if (selectPlate.value === 'cie') {
        selectPlate.value = 'std';
        state.plateType = 'std';
      }
    }
  }

  // Core Calculation Engine
  function calculateMaterials() {
    const { mode, largo, alto, openingsM2, spacing, wastePct, plateType, insulation } = state;
    const grossArea = largo * alto;
    const netArea = Math.max(0.1, grossArea - openingsM2);
    const PLATE_SURFACE = 2.88; // 1.20 x 2.40 m

    let faces = 1;
    if (mode === 'tabique') faces = 2;

    const totalPlatesArea = netArea * faces;
    const platesRequired = Math.ceil((totalPlatesArea * (1 + wastePct)) / PLATE_SURFACE);

    let solerasMeters = 0;
    let montantesQty = 0;
    let tornillosT1 = 0;
    let tornillosT2 = platesRequired * 32;
    let tarugosQty = 0;
    let cintaMeters = Math.ceil(totalPlatesArea * 1.6 * (1 + wastePct));
    let masillaKg = Math.ceil(totalPlatesArea * 0.95 * (1 + wastePct));
    let rollosCinta = Math.ceil(cintaMeters / 75); // standard roll 75m
    let baldesMasilla15k = Math.ceil(masillaKg / 15); // standard bucket 15kg

    if (mode === 'tabique') {
      // Soleras: floor and ceiling
      solerasMeters = largo * 2;
      const heightFactor = alto > 2.60 ? (alto / 2.60) * 1.15 : 1.0;
      const studsCount = Math.ceil(largo / spacing) + 1;
      montantesQty = Math.ceil(studsCount * heightFactor * 1.05);
      tornillosT1 = Math.ceil(netArea * 10);
      tarugosQty = Math.ceil(((largo * 2) + (alto * 2)) / 0.50);
    } else if (mode === 'revestimiento') {
      solerasMeters = largo * 2;
      const heightFactor = alto > 2.60 ? (alto / 2.60) * 1.15 : 1.0;
      const studsCount = Math.ceil(largo / spacing) + 1;
      montantesQty = Math.ceil(studsCount * heightFactor * 1.05);
      tornillosT1 = Math.ceil(netArea * 6);
      tarugosQty = Math.ceil(((largo * 2) + (alto * 2)) / 0.50);
    } else if (mode === 'cielorraso') {
      const perimeter = 2 * (largo + alto);
      solerasMeters = perimeter;
      // Grid of primary & secondary studs
      const totalStudsMeters = netArea * 2.4;
      montantesQty = Math.ceil((totalStudsMeters * 1.05) / 2.60);
      const velasSuspension = Math.ceil(netArea * 1.2);
      tornillosT1 = Math.ceil(netArea * 8);
      tarugosQty = Math.ceil((perimeter / 0.50) + velasSuspension);
    }

    const solerasTiras = Math.ceil((solerasMeters * 1.05) / 2.60);

    return {
      netArea: parseFloat(netArea.toFixed(2)),
      totalPlatesArea: parseFloat(totalPlatesArea.toFixed(2)),
      platesRequired,
      plateName: PLATE_NAMES[plateType] || PLATE_NAMES.std,
      solerasTiras,
      solerasMeters: parseFloat(solerasMeters.toFixed(1)),
      montantesQty,
      tornillosT1: Math.ceil(tornillosT1 / 10) * 10,
      tornillosT2: Math.ceil(tornillosT2 / 10) * 10,
      tarugosQty: Math.ceil(tarugosQty / 10) * 10,
      cintaMeters,
      rollosCinta,
      masillaKg,
      baldesMasilla15k,
      insulationM2: insulation ? parseFloat(netArea.toFixed(2)) : 0
    };
  }

  function recalculate() {
    const data = calculateMaterials();

    // Update hero metrics
    metricStructureArea.textContent = `${data.netArea} m²`;
    metricPlatesArea.textContent = `${data.totalPlatesArea} m²`;
    metricPlatesCount.textContent = `${data.platesRequired} u`;

    // Render materials list
    const items = [
      {
        icon: '🧱',
        name: data.plateName,
        desc: 'Placa de yeso 1.20 x 2.40 m (2.88 m²)',
        val: data.platesRequired,
        unit: 'placas'
      },
      {
        icon: '📐',
        name: state.mode === 'cielorraso' ? 'Soleras Perimetrales 35mm' : 'Perfiles Solera 70mm / 35mm',
        desc: `${data.solerasMeters} m lineales en tiras comerciales de 2.60m`,
        val: data.solerasTiras,
        unit: 'tiras (2.60m)'
      },
      {
        icon: '📏',
        name: state.mode === 'cielorraso' ? 'Perfiles Montante / F-47 Cielorraso' : 'Perfiles Montante 69mm / 34mm',
        desc: `Estructura vertical / suspensión (cada ${state.spacing * 100} cm)`,
        val: data.montantesQty,
        unit: 'tiras (2.60m)'
      },
      {
        icon: '🔩',
        name: 'Tornillos T1 Punta Aguja',
        desc: 'Fijación de perfiles metal con metal (chapa-chapa)',
        val: data.tornillosT1,
        unit: 'unidades'
      },
      {
        icon: '🪛',
        name: 'Tornillos T2 Punta Aguja',
        desc: 'Fijación de placas a montantes metálicos',
        val: data.tornillosT2,
        unit: 'unidades'
      },
      {
        icon: '📍',
        name: 'Tarugos N°8 con Tornillo',
        desc: 'Fijación de soleras a piso, losa y paredes',
        val: data.tarugosQty,
        unit: 'unidades'
      },
      {
        icon: '📜',
        name: 'Cinta de Papel Microperforada',
        desc: `Tomado de juntas (${data.cintaMeters} m totales necesarios)`,
        val: data.rollosCinta,
        unit: 'rollo(s) de 75m'
      },
      {
        icon: '🧪',
        name: 'Masilla para Durlock (Lista para usar)',
        desc: `Tomado de juntas y tornillos (${data.masillaKg} kg aprox.)`,
        val: data.baldesMasilla15k,
        unit: 'balde(s) de 15 kg'
      }
    ];

    if (data.insulationM2 > 0) {
      items.push({
        icon: '🛡️',
        name: 'Aislación Lana de Vidrio / Lana de Roca',
        desc: 'Aislación termoacústica interior de 50mm',
        val: data.insulationM2,
        unit: 'm²'
      });
    }

    materialsListEl.innerHTML = items.map(item => `
      <div class="material-item">
        <div class="material-info">
          <span class="material-icon">${item.icon}</span>
          <div>
            <div class="material-name">${item.name}</div>
            <div class="material-desc">${item.desc}</div>
          </div>
        </div>
        <div class="material-qty">
          <div class="material-val">${item.val}</div>
          <div class="material-unit">${item.unit}</div>
        </div>
      </div>
    `).join('');
  }

  // Copy for WhatsApp
  function copyForWhatsApp() {
    const data = calculateMaterials();
    const modeName = state.mode === 'tabique' 
      ? 'Tabique Divisorio (2 caras)' 
      : state.mode === 'revestimiento' 
      ? 'Revestimiento / Mediopared (1 cara)' 
      : 'Cielorraso Suspendido';

    const text = `📋 *PEDIDO DE MATERIALES DURLOCK*
📍 *Tipo de Obra:* ${modeName}
📐 *Medidas:* ${state.largo}m x ${state.alto}m (${data.netArea} m²)
📦 *Desperdicio estimado:* ${state.wastePct * 100}%

*Lista para Corralón:*
• ${data.platesRequired} u — ${data.plateName}
• ${data.solerasTiras} tiras — Soleras (2.60m)
• ${data.montantesQty} tiras — Montantes (2.60m)
• ${data.tornillosT1} u — Tornillos T1 (chapa-chapa)
• ${data.tornillosT2} u — Tornillos T2 (placa-chapa)
• ${data.tarugosQty} u — Tarugos N°8 con tornillo
• ${data.rollosCinta} rollo(s) — Cinta de papel microperforada (75m)
• ${data.baldesMasilla15k} balde(s) — Masilla lista para usar (15kg)${data.insulationM2 > 0 ? `\n• ${data.insulationM2} m² — Lana de vidrio termoacústica` : ''}

Calculado con: https://sebiglesias.com.ar/durlock/`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ ¡Lista copiada para WhatsApp!');
    }).catch(() => {
      showToast('❌ Error al copiar al portapapeles');
    });
  }

  // Save room to budget list
  function saveCurrentRoom() {
    const data = calculateMaterials();
    const roomName = prompt('Nombre para esta pared / ambiente:', `Ambiente ${state.savedItems.length + 1}`);
    if (!roomName) return;

    state.savedItems.push({
      name: roomName,
      mode: state.mode,
      dim: `${state.largo}m x ${state.alto}m`,
      plates: data.platesRequired,
      soleras: data.solerasTiras,
      montantes: data.montantesQty
    });

    localStorage.setItem('durlock_saved_rooms', JSON.stringify(state.savedItems));
    showToast(`💾 "${roomName}" guardado en presupuesto!`);
  }

  function loadSavedItems() {
    try {
      const saved = localStorage.getItem('durlock_saved_rooms');
      if (saved) state.savedItems = JSON.parse(saved);
    } catch (e) {
      state.savedItems = [];
    }
  }

  // Toast
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Theme
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('durlock_theme', next);
    updateThemeIcon(next);
  }

  function loadTheme() {
    const saved = localStorage.getItem('durlock_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function updateThemeIcon(theme) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
