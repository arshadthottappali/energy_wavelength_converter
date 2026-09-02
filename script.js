(function () {
  "use strict";

  var HC_EV_NM = 1239.84198;   // eV * nm
  var C_NM_THZ = 299792.458;   // nm * THz (speed of light)
  var EV_TO_JOULE = 1.602176634e-19;

  var nmInput = document.getElementById("input-nm");
  var evInput = document.getElementById("input-ev");
  var cm1Input = document.getElementById("input-cm1");
  var thzInput = document.getElementById("input-thz");
  var jOutput = document.getElementById("input-j");
  var umOutput = document.getElementById("input-um");
  var clearBtn = document.getElementById("clear-btn");
  var exportBtn = document.getElementById("export-btn");
  var exportTableBtn = document.getElementById("export-table-btn");
  var laserTable = document.getElementById("laser-table");

  function formatNumber(value) {
    if (!isFinite(value)) return "";
    var abs = Math.abs(value);
    var decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    var out = value.toFixed(decimals);
    return out.replace(/\.?0+$/, "").replace(/\.$/, "") || "0";
  }

  function updateDerived(wavelengthNm) {
    if (!isFinite(wavelengthNm) || wavelengthNm <= 0) {
      jOutput.value = "";
      umOutput.value = "";
      return;
    }
    var energyEv = HC_EV_NM / wavelengthNm;
    jOutput.value = (energyEv * EV_TO_JOULE).toExponential(4) + " J";
    umOutput.value = formatNumber(wavelengthNm / 1000) + " µm";
  }

  function fromWavelength(nm, skip) {
    var v = parseFloat(nm);
    if (!isFinite(v) || v <= 0) return;
    if (skip !== evInput) evInput.value = formatNumber(HC_EV_NM / v);
    if (skip !== cm1Input) cm1Input.value = formatNumber(1e7 / v);
    if (skip !== thzInput) thzInput.value = formatNumber(C_NM_THZ / v);
    updateDerived(v);
  }

  function setWavelength(nm) {
    nmInput.value = formatNumber(nm);
    fromWavelength(nm, nmInput);
  }

  nmInput.addEventListener("input", function () {
    var v = parseFloat(nmInput.value);
    if (!isFinite(v) || v <= 0) return;
    fromWavelength(v, nmInput);
  });

  evInput.addEventListener("input", function () {
    var v = parseFloat(evInput.value);
    if (!isFinite(v) || v <= 0) return;
    setWavelength(HC_EV_NM / v);
  });

  cm1Input.addEventListener("input", function () {
    var v = parseFloat(cm1Input.value);
    if (!isFinite(v) || v <= 0) return;
    setWavelength(1e7 / v);
  });

  thzInput.addEventListener("input", function () {
    var v = parseFloat(thzInput.value);
    if (!isFinite(v) || v <= 0) return;
    setWavelength(C_NM_THZ / v);
  });

  clearBtn.addEventListener("click", function () {
    [nmInput, evInput, cm1Input, thzInput, jOutput, umOutput].forEach(function (el) {
      el.value = "";
    });
    nmInput.focus();
  });

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        var s = String(cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportBtn.addEventListener("click", function () {
    var rows = [
      ["Quantity", "Value", "Unit"],
      ["Wavelength", nmInput.value, "nm"],
      ["Energy", evInput.value, "eV"],
      ["Wavenumber", cm1Input.value, "cm-1"],
      ["Frequency", thzInput.value, "THz"],
      ["Energy", jOutput.value.replace(" J", ""), "J"],
      ["Wavelength", umOutput.value.replace(" µm", ""), "um"],
    ];
    downloadCsv("wavelength-energy-conversion.csv", rows);
  });

  exportTableBtn.addEventListener("click", function () {
    var rows = [];
    laserTable.querySelectorAll("tr").forEach(function (tr) {
      var cells = Array.prototype.map.call(
        tr.querySelectorAll("th,td"),
        function (cell) { return cell.textContent.trim(); }
      );
      rows.push(cells);
    });
    downloadCsv("common-laser-wavelength-reference.csv", rows);
  });

  setWavelength(632.8);
})();

(function () {
  "use strict";

  var HC_EV_NM = 1239.84198;
  var OKABE_ITO = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#888888"];

  var canvas = document.getElementById("spectra-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var measureCtx = document.createElement("canvas").getContext("2d");

  var tooltip = document.getElementById("spectra-tooltip");
  var statusEl = document.getElementById("spectra-status");
  var axisUnitSelect = document.getElementById("spectra-axis-unit");
  var modeSelect = document.getElementById("spectra-mode");

  var datasetsContainer = document.getElementById("spectra-datasets");
  var addDatasetBtn = document.getElementById("spectra-add-dataset-btn");
  var rowTemplate = document.getElementById("spectra-dataset-row-template");

  var pngBtn = document.getElementById("spectra-png-btn");
  var svgBtn = document.getElementById("spectra-svg-btn");
  var dataBtn = document.getElementById("spectra-data-btn");
  var clearBtn = document.getElementById("spectra-clear-btn");
  var globalUploadInput = document.getElementById("spectra-upload-input");
  var saveProjectBtn = document.getElementById("spectra-save-project-btn");
  var loadProjectInput = document.getElementById("spectra-load-project-input");
  var shareGroupEl = document.getElementById("spectra-share-group");
  var shareModeSelect = document.getElementById("spectra-share-mode");
  var shareBtn = document.getElementById("spectra-share-btn");

  var folderTreeEl = document.getElementById("spectra-folder-tree");
  var newFolderBtn = document.getElementById("spectra-new-folder-btn");
  var folderSearchInput = document.getElementById("spectra-folder-search");
  var undoToastEl = document.getElementById("spectra-undo-toast");
  var undoMessageEl = document.getElementById("spectra-undo-message");
  var undoBtn = document.getElementById("spectra-undo-btn");
  var folderStatusEl = document.getElementById("spectra-folder-status");
  var exportAllBtn = document.getElementById("spectra-export-all-btn");
  var importAllInput = document.getElementById("spectra-import-all-input");

  var importModalOverlay = document.getElementById("spectra-import-modal");
  var importModalCloseBtn = document.getElementById("spectra-import-modal-close");
  var importModalSourceEl = document.getElementById("spectra-import-modal-source");
  var importPreviewBody = document.getElementById("spectra-import-preview-body");
  var importPreviewMoreEl = document.getElementById("spectra-import-preview-more");
  var importXColSelect = document.getElementById("spectra-import-xcol");
  var importModeSelect = document.getElementById("spectra-import-mode");
  var importUnitSelect = document.getElementById("spectra-import-unit");
  var importSummaryEl = document.getElementById("spectra-import-summary");
  var importCancelBtn = document.getElementById("spectra-import-cancel-btn");
  var importLoadBtn = document.getElementById("spectra-import-load-btn");

  var titleInput = document.getElementById("spectra-title");
  var bgModeSelect = document.getElementById("spectra-bg-mode");
  var bgCustomWrap = document.getElementById("spectra-bg-custom-wrap");
  var bgCustomInput = document.getElementById("spectra-bg-custom");
  var closedBoxInput = document.getElementById("spectra-closed-box");
  var xGridInput = document.getElementById("spectra-xgrid");
  var yGridInput = document.getElementById("spectra-ygrid");
  var xMinInput = document.getElementById("spectra-xmin");
  var xMaxInput = document.getElementById("spectra-xmax");
  var xStepInput = document.getElementById("spectra-xstep");
  var yMinInput = document.getElementById("spectra-ymin");
  var yMaxInput = document.getElementById("spectra-ymax");
  var yStepInput = document.getElementById("spectra-ystep");
  var resetAxesBtn = document.getElementById("spectra-reset-axes-btn");
  var legendPositionSelect = document.getElementById("spectra-legend-position");
  var xAxisLabelInput = document.getElementById("spectra-xaxis-label");
  var yAxisLabelInput = document.getElementById("spectra-yaxis-label");
  var xGridOpacityInput = document.getElementById("spectra-xgrid-opacity");
  var yGridOpacityInput = document.getElementById("spectra-ygrid-opacity");

  var datasets = [];
  var datasetIdCounter = 0;
  var spectrumMode = "absorption";

  function makeDefaultCustom() {
    return {
      title: "", xMin: null, xMax: null, xStep: null, yMin: null, yMax: null, yStep: null,
      bgMode: "transparent", bgCustomColor: "#ffffff", closedBox: true, showXGrid: true, showYGrid: true,
      xGridOpacity: 0.15, yGridOpacity: 0.5, legendPosition: "top-right",
      xAxisLabelOverride: "", yAxisLabelOverride: ""
    };
  }
  var custom = makeDefaultCustom();

  var folders = [];
  var activeFolderId = null;
  var dbInstance = null;
  var dbAvailable = false;
  var persistDebounceTimer = null;
  var DB_NAME = "spectrawave-projects", DB_VERSION = 1, STORE_NAME = "folders";
  var plotBox = null;
  var padLeft = 58, padRight = 16, padTop = 56, padBottom = 46;

  function numOrNull(el) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : null;
  }

  function readCustom() {
    custom.title = titleInput.value;
    custom.bgMode = bgModeSelect.value;
    custom.bgCustomColor = bgCustomInput.value;
    custom.closedBox = closedBoxInput.checked;
    custom.showXGrid = xGridInput.checked;
    custom.showYGrid = yGridInput.checked;
    custom.xMin = numOrNull(xMinInput);
    custom.xMax = numOrNull(xMaxInput);
    custom.xStep = numOrNull(xStepInput);
    custom.yMin = numOrNull(yMinInput);
    custom.yMax = numOrNull(yMaxInput);
    custom.yStep = numOrNull(yStepInput);
    custom.xGridOpacity = xGridOpacityInput ? parseFloat(xGridOpacityInput.value) || 0 : custom.xGridOpacity;
    custom.yGridOpacity = yGridOpacityInput ? parseFloat(yGridOpacityInput.value) || 0 : custom.yGridOpacity;
    custom.legendPosition = legendPositionSelect ? legendPositionSelect.value : custom.legendPosition;
    custom.xAxisLabelOverride = xAxisLabelInput ? xAxisLabelInput.value : custom.xAxisLabelOverride;
    custom.yAxisLabelOverride = yAxisLabelInput ? yAxisLabelInput.value : custom.yAxisLabelOverride;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }

  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function stepTicks(min, max, step) {
    if (!(step > 0)) return null;
    var ticks = [];
    for (var v = min; v <= max + step * 0.5; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return ticks;
  }

  function convertFromNm(nm, unit) {
    if (unit === "eV") return HC_EV_NM / nm;
    if (unit === "cm-1") return 1e7 / nm;
    return nm;
  }

  function convertToNm(v, unit) {
    if (unit === "eV") return HC_EV_NM / v;
    if (unit === "cm-1") return 1e7 / v;
    return v;
  }

  function unitLabel(unit) {
    if (unit === "eV") return "Energy (eV)";
    if (unit === "cm-1") return "Wavenumber (cm⁻¹)";
    return "Wavelength (nm)";
  }

  function formatVal(v, unit) {
    if (unit === "eV") return v.toFixed(v < 10 ? 3 : 1);
    if (unit === "cm-1") return v >= 1000 ? Math.round(v).toString() : v.toFixed(1);
    return v >= 100 ? Math.round(v).toString() : v.toFixed(1);
  }

  function getPairUnit(unit) {
    return unit === "eV" ? "nm" : "eV";
  }

  function yAxisTitle() {
    if (custom.yAxisLabelOverride && custom.yAxisLabelOverride.trim()) return custom.yAxisLabelOverride.trim();
    return spectrumMode === "fluorescence" ? "Fluorescence Intensity (a.u.)" : "Absorbance (a.u.)";
  }

  function xAxisTitle(unit) {
    if (custom.xAxisLabelOverride && custom.xAxisLabelOverride.trim()) return custom.xAxisLabelOverride.trim();
    return unitLabel(unit);
  }

  function yValueLabel() {
    return spectrumMode === "fluorescence" ? "Intensity" : "Absorbance";
  }

  function normalizeSeries(y, xNm, mode) {
    if (mode === "max") {
      var max = Math.max.apply(null, y);
      return max ? y.map(function (v) { return v / max; }) : y.slice();
    }
    if (mode === "min") {
      var min = Math.min.apply(null, y);
      return min ? y.map(function (v) { return v / min; }) : y.slice();
    }
    if (mode === "minmax") {
      var lo = Math.min.apply(null, y), hi = Math.max.apply(null, y), range = hi - lo;
      return range ? y.map(function (v) { return (v - lo) / range; }) : y.slice();
    }
    if (mode === "area") {
      var auc = 0;
      for (var i = 1; i < xNm.length; i++) auc += (xNm[i] - xNm[i - 1]) * (y[i] + y[i - 1]) / 2;
      auc = Math.abs(auc);
      return auc ? y.map(function (v) { return v / auc; }) : y.slice();
    }
    return y.slice();
  }

  function interpolateSeriesAt(srcXNm, srcY, targetXNm) {
    return targetXNm.map(function (xnm) {
      if (!srcXNm.length) return 0;
      if (xnm <= srcXNm[0]) return srcY[0];
      if (xnm >= srcXNm[srcXNm.length - 1]) return srcY[srcY.length - 1];
      var lo = 0, hi = srcXNm.length - 1;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (srcXNm[mid] <= xnm) lo = mid; else hi = mid;
      }
      var x0 = srcXNm[lo], x1 = srcXNm[hi], y0 = srcY[lo], y1 = srcY[hi];
      var t = (xnm - x0) / (x1 - x0 || 1);
      return y0 + t * (y1 - y0);
    });
  }

  function displayY(ds) {
    var y = ds.y;
    if (ds.subtractDatasetId) {
      var baseline = datasets.find(function (d) { return d.id === ds.subtractDatasetId; });
      if (baseline && baseline.xNm.length) {
        var baselineY = interpolateSeriesAt(baseline.xNm, baseline.y, ds.xNm);
        y = y.map(function (v, i) { return v - baselineY[i]; });
      }
    }
    return normalizeSeries(y, ds.xNm, ds.normalize).map(function (v) { return v + ds.offset; });
  }

  function findPeaks(y, sensitivity) {
    if (y.length < 3) return [];
    var yMin = Math.min.apply(null, y), yMax = Math.max.apply(null, y);
    var range = yMax - yMin || 1;
    var minProminence = sensitivity * range * 0.5;
    var peaks = [];
    for (var i = 1; i < y.length - 1; i++) {
      if (y[i] >= y[i - 1] && y[i] >= y[i + 1] && (y[i] > y[i - 1] || y[i] > y[i + 1])) {
        var leftMin = y[i];
        for (var l = i - 1; l >= 0; l--) {
          if (y[l] > y[i]) break;
          if (y[l] < leftMin) leftMin = y[l];
        }
        var rightMin = y[i];
        for (var r = i + 1; r < y.length; r++) {
          if (y[r] > y[i]) break;
          if (y[r] < rightMin) rightMin = y[r];
        }
        var prominence = y[i] - Math.max(leftMin, rightMin);
        if (prominence >= minProminence) {
          peaks.push({ index: i, value: y[i], prominence: prominence });
        }
      }
    }
    peaks.sort(function (a, b) { return b.prominence - a.prominence; });
    return peaks.slice(0, 10);
  }

  function dashArrayFor(style) {
    if (style === "dashed") return [8, 5];
    if (style === "dotted") return [2, 4];
    return [];
  }

  function niceNum(range, round) {
    var exponent = Math.floor(Math.log10(range));
    var fraction = range / Math.pow(10, exponent);
    var niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var range = niceNum(max - min, false);
    var step = niceNum(range / (count - 1), true);
    var niceMin = Math.floor(min / step) * step;
    var niceMax = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = niceMin; v <= niceMax + step * 0.5; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return ticks;
  }

  function generateExampleSpectrum() {
    var xNm = [], yRaw = [];
    for (var nm = 380; nm <= 560; nm += 2) {
      var main = Math.exp(-Math.pow(nm - 490, 2) / (2 * Math.pow(13, 2)));
      var shoulder = 0.42 * Math.exp(-Math.pow(nm - 460, 2) / (2 * Math.pow(11, 2)));
      xNm.push(nm);
      yRaw.push(main + shoulder);
    }
    var max = Math.max.apply(null, yRaw);
    var y = yRaw.map(function (v) { return Math.round((v / max) * 1000) / 1000; });
    return { xNm: xNm, y: y, label: "fluorescein-example (illustrative)" };
  }

  function generateExampleEmissionSpectrum() {
    var xNm = [], yRaw = [];
    for (var nm = 480; nm <= 650; nm += 2) {
      var main = Math.exp(-Math.pow(nm - 513, 2) / (2 * Math.pow(15, 2)));
      var tail = 0.28 * Math.exp(-Math.pow(nm - 555, 2) / (2 * Math.pow(28, 2)));
      xNm.push(nm);
      yRaw.push(main + tail);
    }
    var max = Math.max.apply(null, yRaw);
    var y = yRaw.map(function (v) { return Math.round((v / max) * 1000) / 1000; });
    return { xNm: xNm, y: y, label: "fluorescein-emission-example (illustrative)" };
  }

  function generateExample() {
    return spectrumMode === "fluorescence" ? generateExampleEmissionSpectrum() : generateExampleSpectrum();
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("status-error", !!isError);
  }

  function setRowStatus(row, msg, isError) {
    var el = row.querySelector('[data-role="status"]');
    el.textContent = msg;
    el.classList.toggle("status-error", !!isError);
  }

  function setFolderStatus(msg, isError) {
    folderStatusEl.textContent = msg;
    folderStatusEl.classList.toggle("status-error", !!isError);
  }

  var undoTimer = null;
  var pendingUndo = null;

  function showUndoToast(message, restoreFn) {
    if (undoTimer) clearTimeout(undoTimer);
    undoMessageEl.textContent = message;
    undoToastEl.hidden = false;
    pendingUndo = restoreFn;
    undoTimer = setTimeout(function () {
      undoToastEl.hidden = true;
      pendingUndo = null;
    }, 8000);
  }

  undoBtn.addEventListener("click", function () {
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    undoToastEl.hidden = true;
    if (pendingUndo) {
      var fn = pendingUndo;
      pendingUndo = null;
      fn();
    }
  });

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbGetAllFolders() {
    return new Promise(function (resolve, reject) {
      var tx = dbInstance.transaction(STORE_NAME, "readonly");
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbPutFolder(folder) {
    if (!dbAvailable) return;
    try {
      dbInstance.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(folder);
    } catch (e) { /* best-effort persistence */ }
  }

  function dbDeleteFolder(id) {
    if (!dbAvailable) return;
    try {
      dbInstance.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    } catch (e) { /* best-effort persistence */ }
  }

  function layout() {
    var rect = canvas.parentElement.getBoundingClientRect();
    var cssWidth = Math.max(280, rect.width);
    var cssHeight = 360;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: cssWidth, height: cssHeight };
  }

  function readThemeColors() {
    var rootStyles = getComputedStyle(document.documentElement);
    return {
      text: rootStyles.getPropertyValue("--text-dim").trim() || "#9aa3b5",
      strongText: rootStyles.getPropertyValue("--text").trim() || "#e6e9f0",
      grid: rootStyles.getPropertyValue("--border").trim() || "#232838",
      bgElev: rootStyles.getPropertyValue("--bg-elev").trim() || "#11151f"
    };
  }

  function resolveBackgroundColor(bgMode, bgCustomColor, themeBgElev) {
    if (bgMode === "white") return "#ffffff";
    if (bgMode === "theme") return themeBgElev;
    if (bgMode === "custom") return bgCustomColor;
    return null;
  }

  function legendChipWidth(mctx, text, font) {
    mctx.font = font;
    var swatchW = 14, boxPad = 6;
    var textW = mctx.measureText(text).width;
    return swatchW + boxPad * 2 + textW + 6;
  }

  function computeLegendLayout(L, mctx, fontFamily, position) {
    if (position === "hidden") return [];
    var isLeft = position === "top-left" || position === "bottom-left";
    var isBottom = position === "bottom-left" || position === "bottom-right";
    var y = isBottom ? L.bottom - 26 : L.top + 6;
    var step = isBottom ? -24 : 24;
    return L.visible.map(function (d) {
      var legendText = (d.label && d.label.trim()) || "Spectrum";
      var boxW = legendChipWidth(mctx, legendText, "12px " + fontFamily);
      var bx = isLeft ? L.left + 6 : L.right - boxW - 6;
      var by = y;
      y += step;
      return { d: d, legendText: legendText, boxW: boxW, bx: bx, by: by };
    });
  }

  function computePeakMarkers(L) {
    var markers = [];
    L.visible.forEach(function (d) {
      var sel = d.selectedPeakIndices || [];
      if (!sel.length) return;
      var dy = displayY(d);
      sel.forEach(function (idx) {
        if (idx < 0 || idx >= d.xNm.length) return;
        var xv = convertFromNm(d.xNm[idx], L.bottomUnit);
        markers.push({ d: d, px: L.xPix(xv), py: L.yPix(dy[idx]), label: formatVal(xv, L.bottomUnit) });
      });
    });
    return markers;
  }

  function computeChartLayout(width, height, dsList, bottomUnit, customSettings) {
    var topUnit = getPairUnit(bottomUnit);
    var visible = dsList.filter(function (d) { return d.visible && d.xNm.length; });

    var autoXMin = Infinity, autoXMax = -Infinity;
    var autoYMin = 0, autoYMax = -Infinity;
    visible.forEach(function (d) {
      var dy = displayY(d);
      d.xNm.forEach(function (nm, i) {
        var xv = convertFromNm(nm, bottomUnit);
        if (xv < autoXMin) autoXMin = xv;
        if (xv > autoXMax) autoXMax = xv;
        var yv = dy[i];
        if (yv > autoYMax) autoYMax = yv;
        if (yv < autoYMin) autoYMin = yv;
      });
    });
    if (!isFinite(autoXMin)) { autoXMin = 0; autoXMax = 1; }
    if (autoXMin === autoXMax) { autoXMin -= 1; autoXMax += 1; }
    if (!isFinite(autoYMax)) autoYMax = 1;
    autoYMax = autoYMax * 1.12 || 1;
    autoYMin = Math.min(0, autoYMin);

    var xMin = customSettings.xMin != null ? customSettings.xMin : autoXMin;
    var xMax = customSettings.xMax != null ? customSettings.xMax : autoXMax;
    if (xMin === xMax) xMax = xMin + 1;
    var yMin = customSettings.yMin != null ? customSettings.yMin : autoYMin;
    var yMax = customSettings.yMax != null ? customSettings.yMax : autoYMax;
    if (yMax <= yMin) yMax = yMin + 1;

    var left = padLeft, right = width - padRight, top = padTop, bottom = height - padBottom;
    var plotW = right - left, plotH = bottom - top;

    function xPix(v) { return left + ((v - xMin) / (xMax - xMin)) * plotW; }
    function yPix(v) { return bottom - ((v - yMin) / (yMax - yMin)) * plotH; }

    var yTicks = (stepTicks(yMin, yMax, customSettings.yStep) || niceTicks(yMin, yMax, 5))
      .filter(function (t) { return t >= yMin - 1e-9 && t <= yMax + 1e-9; })
      .map(function (t) { return { value: t, px: yPix(t) }; });

    var xTicks = (stepTicks(xMin, xMax, customSettings.xStep) || niceTicks(xMin, xMax, 6))
      .filter(function (t) { return t >= xMin - 1e-9 && t <= xMax + 1e-9; })
      .map(function (t) { return { value: t, px: xPix(t) }; });

    var nmAtXMin = convertToNm(xMin, bottomUnit);
    var nmAtXMax = convertToNm(xMax, bottomUnit);
    var topAtXMin = convertFromNm(nmAtXMin, topUnit);
    var topAtXMax = convertFromNm(nmAtXMax, topUnit);
    var topLo = Math.min(topAtXMin, topAtXMax);
    var topHi = Math.max(topAtXMin, topAtXMax);
    var topTicks = [];
    niceTicks(topLo, topHi, 5).forEach(function (tv) {
      if (tv < topLo - 1e-9 || tv > topHi + 1e-9) return;
      var nmEquiv = convertToNm(tv, topUnit);
      var bottomEquiv = convertFromNm(nmEquiv, bottomUnit);
      if (bottomEquiv < xMin - 1e-9 || bottomEquiv > xMax + 1e-9) return;
      topTicks.push({ value: tv, px: xPix(bottomEquiv) });
    });

    return {
      left: left, right: right, top: top, bottom: bottom, plotW: plotW, plotH: plotH,
      xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax,
      bottomUnit: bottomUnit, topUnit: topUnit,
      xPix: xPix, yPix: yPix,
      yTicks: yTicks, xTicks: xTicks, topTicks: topTicks,
      visible: visible
    };
  }

  function refreshAllSubtractSelects() {
    datasets.forEach(function (ds) {
      var stillValid = !ds.subtractDatasetId || datasets.some(function (d) { return d.id === ds.subtractDatasetId; });
      if (!stillValid) ds.subtractDatasetId = null;

      var row = datasetsContainer.querySelector('[data-ds-id="' + ds.id + '"]');
      if (!row) return;
      var select = row.querySelector('[data-role="subtract"]');
      if (!select) return;

      var currentValue = ds.subtractDatasetId || "";
      select.innerHTML = "";
      var noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "None";
      select.appendChild(noneOpt);
      datasets.forEach(function (other) {
        if (other.id === ds.id) return;
        var opt = document.createElement("option");
        opt.value = other.id;
        opt.textContent = (other.label && other.label.trim()) || "Spectrum";
        select.appendChild(opt);
      });
      select.value = currentValue;
    });
  }

  function draw() {
    scheduleFolderPersist();
    refreshAllSubtractSelects();
    var dims = layout();
    renderChart(ctx, dims.width, dims.height, true);
  }

  function renderChart(targetCtx, width, height, isPrimary) {
    var bottomUnit = axisUnitSelect.value;
    var theme = readThemeColors();
    var fontFamily = getComputedStyle(document.body).fontFamily;

    targetCtx.clearRect(0, 0, width, height);

    var bgColor = resolveBackgroundColor(custom.bgMode, custom.bgCustomColor, theme.bgElev);
    if (bgColor) {
      targetCtx.fillStyle = bgColor;
      targetCtx.fillRect(0, 0, width, height);
    }

    var L = computeChartLayout(width, height, datasets, bottomUnit, custom);
    if (isPrimary) plotBox = L;

    if (!L.visible.length) {
      targetCtx.fillStyle = theme.text;
      targetCtx.font = "13px " + fontFamily;
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.fillText("No spectra loaded", width / 2, height / 2);
      return;
    }

    targetCtx.font = "12px " + fontFamily;
    targetCtx.textAlign = "right";
    targetCtx.textBaseline = "middle";
    L.yTicks.forEach(function (t) {
      if (custom.showYGrid) {
        targetCtx.beginPath();
        targetCtx.moveTo(L.left, t.px);
        targetCtx.lineTo(L.right, t.px);
        targetCtx.strokeStyle = theme.grid;
        targetCtx.globalAlpha = custom.yGridOpacity;
        targetCtx.stroke();
        targetCtx.globalAlpha = 1;
      }
      targetCtx.fillStyle = theme.text;
      targetCtx.fillText(t.value.toFixed(2), L.left - 8, t.px);
      if (custom.closedBox) {
        targetCtx.beginPath();
        targetCtx.moveTo(L.right, t.px);
        targetCtx.lineTo(L.right - 5, t.px);
        targetCtx.strokeStyle = theme.text;
        targetCtx.globalAlpha = 0.6;
        targetCtx.stroke();
        targetCtx.globalAlpha = 1;
      }
    });

    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "top";
    L.xTicks.forEach(function (t) {
      if (custom.showXGrid) {
        targetCtx.beginPath();
        targetCtx.moveTo(t.px, L.top);
        targetCtx.lineTo(t.px, L.bottom);
        targetCtx.strokeStyle = theme.grid;
        targetCtx.globalAlpha = custom.xGridOpacity;
        targetCtx.stroke();
        targetCtx.globalAlpha = 1;
      }
      targetCtx.fillStyle = theme.text;
      targetCtx.fillText(formatVal(t.value, L.bottomUnit), t.px, L.bottom + 8);
    });

    targetCtx.textBaseline = "bottom";
    L.topTicks.forEach(function (t) {
      targetCtx.beginPath();
      targetCtx.moveTo(t.px, L.top);
      targetCtx.lineTo(t.px, L.top - 5);
      targetCtx.strokeStyle = theme.text;
      targetCtx.globalAlpha = 0.6;
      targetCtx.stroke();
      targetCtx.globalAlpha = 1;
      targetCtx.fillStyle = theme.text;
      targetCtx.fillText(formatVal(t.value, L.topUnit), t.px, L.top - 7);
    });

    targetCtx.strokeStyle = theme.grid;
    targetCtx.globalAlpha = 1;
    targetCtx.beginPath();
    targetCtx.moveTo(L.left, L.top);
    targetCtx.lineTo(L.left, L.bottom);
    targetCtx.lineTo(L.right, L.bottom);
    if (custom.closedBox) {
      targetCtx.lineTo(L.right, L.top);
      targetCtx.lineTo(L.left, L.top);
    }
    targetCtx.stroke();

    targetCtx.fillStyle = theme.strongText;
    targetCtx.font = "13px " + fontFamily;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "alphabetic";
    targetCtx.fillText(xAxisTitle(L.bottomUnit), (L.left + L.right) / 2, height - 8);
    targetCtx.fillText(unitLabel(L.topUnit), (L.left + L.right) / 2, 32);

    targetCtx.save();
    targetCtx.translate(14, (L.top + L.bottom) / 2);
    targetCtx.rotate(-Math.PI / 2);
    targetCtx.textAlign = "center";
    targetCtx.fillText(yAxisTitle(), 0, 0);
    targetCtx.restore();

    if (custom.title && custom.title.trim()) {
      targetCtx.fillStyle = theme.strongText;
      targetCtx.font = "bold 14px " + fontFamily;
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "alphabetic";
      targetCtx.fillText(custom.title.trim(), width / 2, 16);
    }

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(L.left, L.top, L.plotW, L.plotH);
    targetCtx.clip();
    L.visible.forEach(function (d) {
      var dy = displayY(d);
      targetCtx.beginPath();
      d.xNm.forEach(function (nm, i) {
        var xv = convertFromNm(nm, L.bottomUnit);
        var px = L.xPix(xv), py = L.yPix(dy[i]);
        if (i === 0) targetCtx.moveTo(px, py); else targetCtx.lineTo(px, py);
      });
      targetCtx.strokeStyle = d.color;
      targetCtx.lineWidth = 2.25;
      targetCtx.setLineDash(dashArrayFor(d.lineStyle));
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      if (d.fillArea !== false) {
        targetCtx.lineTo(L.xPix(convertFromNm(d.xNm[d.xNm.length - 1], L.bottomUnit)), L.bottom);
        targetCtx.lineTo(L.xPix(convertFromNm(d.xNm[0], L.bottomUnit)), L.bottom);
        targetCtx.closePath();
        targetCtx.fillStyle = d.color;
        targetCtx.globalAlpha = 0.1;
        targetCtx.fill();
        targetCtx.globalAlpha = 1;
      }
    });
    targetCtx.restore();

    targetCtx.font = "11px " + fontFamily;
    computePeakMarkers(L).forEach(function (m) {
      targetCtx.beginPath();
      targetCtx.moveTo(m.px, m.py - 6);
      targetCtx.lineTo(m.px - 5, m.py - 14);
      targetCtx.lineTo(m.px + 5, m.py - 14);
      targetCtx.closePath();
      targetCtx.fillStyle = m.d.color;
      targetCtx.fill();
      targetCtx.fillStyle = theme.strongText;
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "bottom";
      targetCtx.fillText(m.label, m.px, m.py - 16);
    });

    targetCtx.font = "12px " + fontFamily;
    computeLegendLayout(L, targetCtx, fontFamily, custom.legendPosition).forEach(function (item) {
      var d = item.d, bx = item.bx, by = item.by, boxW = item.boxW;
      targetCtx.fillStyle = theme.bgElev;
      targetCtx.globalAlpha = 0.85;
      targetCtx.fillRect(bx, by, boxW, 20);
      targetCtx.globalAlpha = 1;
      targetCtx.strokeStyle = d.color;
      targetCtx.lineWidth = 2.25;
      targetCtx.setLineDash(dashArrayFor(d.lineStyle));
      targetCtx.beginPath();
      targetCtx.moveTo(bx + 6, by + 10);
      targetCtx.lineTo(bx + 20, by + 10);
      targetCtx.stroke();
      targetCtx.setLineDash([]);
      targetCtx.fillStyle = theme.strongText;
      targetCtx.textAlign = "left";
      targetCtx.textBaseline = "middle";
      targetCtx.fillText(item.legendText, bx + 26, by + 10);
    });
  }

  var EXPORT_SCALE = 3;

  function renderHighResPngBlob(callback) {
    var cssWidth = canvas.clientWidth || 600, cssHeight = 360;
    var off = document.createElement("canvas");
    off.width = cssWidth * EXPORT_SCALE;
    off.height = cssHeight * EXPORT_SCALE;
    var offCtx = off.getContext("2d");
    offCtx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
    renderChart(offCtx, cssWidth, cssHeight, false);
    off.toBlob(callback);
  }

  function buildSvgString(width, height, dsList, bottomUnit, customSettings, theme) {
    var fontFamily = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    var L = computeChartLayout(width, height, dsList, bottomUnit, customSettings);
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + width + ' ' + height + '" font-family=\'' + fontFamily + '\'>');

    var bgColor = resolveBackgroundColor(customSettings.bgMode, customSettings.bgCustomColor, theme.bgElev);
    if (bgColor) {
      parts.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="' + bgColor + '"/>');
    }

    if (!L.visible.length) {
      parts.push('<text x="' + (width / 2) + '" y="' + (height / 2) + '" text-anchor="middle" fill="' + theme.text + '" font-size="13">No spectra loaded</text>');
      parts.push('</svg>');
      return parts.join("");
    }

    L.yTicks.forEach(function (t) {
      if (customSettings.showYGrid) {
        parts.push('<line x1="' + L.left + '" y1="' + t.px + '" x2="' + L.right + '" y2="' + t.px + '" stroke="' + theme.grid + '" stroke-opacity="' + customSettings.yGridOpacity + '"/>');
      }
      parts.push('<text x="' + (L.left - 8) + '" y="' + t.px + '" text-anchor="end" dominant-baseline="middle" fill="' + theme.text + '" font-size="12">' + t.value.toFixed(2) + '</text>');
      if (customSettings.closedBox) {
        parts.push('<line x1="' + L.right + '" y1="' + t.px + '" x2="' + (L.right - 5) + '" y2="' + t.px + '" stroke="' + theme.text + '" stroke-opacity="0.6"/>');
      }
    });

    L.xTicks.forEach(function (t) {
      if (customSettings.showXGrid) {
        parts.push('<line x1="' + t.px + '" y1="' + L.top + '" x2="' + t.px + '" y2="' + L.bottom + '" stroke="' + theme.grid + '" stroke-opacity="' + customSettings.xGridOpacity + '"/>');
      }
      parts.push('<text x="' + t.px + '" y="' + (L.bottom + 8) + '" text-anchor="middle" dominant-baseline="hanging" fill="' + theme.text + '" font-size="12">' + escapeHtml(formatVal(t.value, L.bottomUnit)) + '</text>');
    });

    L.topTicks.forEach(function (t) {
      parts.push('<line x1="' + t.px + '" y1="' + L.top + '" x2="' + t.px + '" y2="' + (L.top - 5) + '" stroke="' + theme.text + '" stroke-opacity="0.6"/>');
      parts.push('<text x="' + t.px + '" y="' + (L.top - 7) + '" text-anchor="middle" fill="' + theme.text + '" font-size="12">' + escapeHtml(formatVal(t.value, L.topUnit)) + '</text>');
    });

    var boxPath = "M" + L.left + " " + L.top + " L" + L.left + " " + L.bottom + " L" + L.right + " " + L.bottom;
    if (customSettings.closedBox) boxPath += " L" + L.right + " " + L.top + " L" + L.left + " " + L.top;
    parts.push('<path d="' + boxPath + '" fill="none" stroke="' + theme.grid + '"/>');

    parts.push('<text x="' + ((L.left + L.right) / 2) + '" y="' + (height - 8) + '" text-anchor="middle" fill="' + theme.strongText + '" font-size="13">' + escapeHtml(xAxisTitle(L.bottomUnit)) + '</text>');
    parts.push('<text x="' + ((L.left + L.right) / 2) + '" y="32" text-anchor="middle" fill="' + theme.strongText + '" font-size="13">' + escapeHtml(unitLabel(L.topUnit)) + '</text>');
    parts.push('<text x="14" y="' + ((L.top + L.bottom) / 2) + '" text-anchor="middle" fill="' + theme.strongText + '" font-size="13" transform="rotate(-90 14 ' + ((L.top + L.bottom) / 2) + ')">' + escapeHtml(yAxisTitle()) + '</text>');

    if (customSettings.title && customSettings.title.trim()) {
      parts.push('<text x="' + (width / 2) + '" y="16" text-anchor="middle" fill="' + theme.strongText + '" font-size="14" font-weight="bold">' + escapeHtml(customSettings.title.trim()) + '</text>');
    }

    var clipId = "spectra-clip-" + Date.now();
    parts.push('<clipPath id="' + clipId + '"><rect x="' + L.left + '" y="' + L.top + '" width="' + L.plotW + '" height="' + L.plotH + '"/></clipPath>');
    parts.push('<g clip-path="url(#' + clipId + ')">');
    L.visible.forEach(function (d) {
      var dy = displayY(d);
      var linePts = d.xNm.map(function (nm, i) {
        var xv = convertFromNm(nm, L.bottomUnit);
        return L.xPix(xv) + "," + L.yPix(dy[i]);
      }).join(" ");
      var fillPts = linePts +
        " " + L.xPix(convertFromNm(d.xNm[d.xNm.length - 1], L.bottomUnit)) + "," + L.bottom +
        " " + L.xPix(convertFromNm(d.xNm[0], L.bottomUnit)) + "," + L.bottom;
      var dash = dashArrayFor(d.lineStyle);
      var dashAttr = dash.length ? ' stroke-dasharray="' + dash.join(",") + '"' : "";
      if (d.fillArea !== false) {
        parts.push('<polygon points="' + fillPts + '" fill="' + d.color + '" fill-opacity="0.1"/>');
      }
      parts.push('<polyline points="' + linePts + '" fill="none" stroke="' + d.color + '" stroke-width="2.25"' + dashAttr + '/>');
    });
    parts.push('</g>');

    computePeakMarkers(L).forEach(function (m) {
      parts.push('<polygon points="' + m.px + ',' + (m.py - 6) + ' ' + (m.px - 5) + ',' + (m.py - 14) + ' ' + (m.px + 5) + ',' + (m.py - 14) + '" fill="' + m.d.color + '"/>');
      parts.push('<text x="' + m.px + '" y="' + (m.py - 16) + '" text-anchor="middle" fill="' + theme.strongText + '" font-size="11">' + escapeHtml(m.label) + '</text>');
    });

    computeLegendLayout(L, measureCtx, fontFamily, customSettings.legendPosition).forEach(function (item) {
      var d = item.d, bx = item.bx, by = item.by, boxW = item.boxW;
      var legendDash = dashArrayFor(d.lineStyle);
      var legendDashAttr = legendDash.length ? ' stroke-dasharray="' + legendDash.join(",") + '"' : "";
      parts.push('<rect x="' + bx + '" y="' + by + '" width="' + boxW + '" height="20" fill="' + theme.bgElev + '" fill-opacity="0.85"/>');
      parts.push('<line x1="' + (bx + 6) + '" y1="' + (by + 10) + '" x2="' + (bx + 20) + '" y2="' + (by + 10) + '" stroke="' + d.color + '" stroke-width="2.25"' + legendDashAttr + '/>');
      parts.push('<text x="' + (bx + 26) + '" y="' + (by + 10) + '" dominant-baseline="middle" fill="' + theme.strongText + '" font-size="12">' + escapeHtml(item.legendText) + '</text>');
    });

    parts.push('</svg>');
    return parts.join("");
  }

  function nearestIndexIn(xNmArr, nmTarget) {
    var lo = 0, hi = xNmArr.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (xNmArr[mid] < nmTarget) lo = mid + 1; else hi = mid;
    }
    if (lo > 0 && Math.abs(xNmArr[lo - 1] - nmTarget) < Math.abs(xNmArr[lo] - nmTarget)) return lo - 1;
    return lo;
  }

  canvas.addEventListener("mousemove", function (e) {
    if (!plotBox || !plotBox.visible.length) { tooltip.style.display = "none"; return; }
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (mx < plotBox.left || mx > plotBox.right || my < plotBox.top || my > plotBox.bottom) {
      tooltip.style.display = "none";
      return;
    }
    var bottomVal = plotBox.xMin + ((mx - plotBox.left) / (plotBox.right - plotBox.left)) * (plotBox.xMax - plotBox.xMin);
    var nmTarget = convertToNm(bottomVal, plotBox.bottomUnit);

    var lines = [];
    plotBox.visible.forEach(function (d) {
      var idx = nearestIndexIn(d.xNm, nmTarget);
      var nm = d.xNm[idx], yVal = displayY(d)[idx];
      var ev = convertFromNm(nm, "eV"), cm1 = convertFromNm(nm, "cm-1");
      var legendText = (d.label && d.label.trim()) || "Spectrum";
      lines.push('<span style="color:' + d.color + '">&#9679;</span> ' + escapeHtml(legendText) + ": " +
        formatVal(nm, "nm") + " nm, " + formatVal(ev, "eV") + " eV, " + formatVal(cm1, "cm-1") + " cm&#8315;&sup1;, Abs " + yVal.toFixed(3));
    });
    tooltip.style.display = "block";
    tooltip.style.left = mx + "px";
    tooltip.style.top = my + "px";
    tooltip.innerHTML = lines.join("<br>");
  });

  canvas.addEventListener("mouseleave", function () {
    tooltip.style.display = "none";
  });

  function isNumericRow(cells) {
    return cells.length >= 2 && cells.every(function (c) { return c !== "" && isFinite(parseFloat(c)); });
  }

  function splitDelimited(line) {
    return line.split(/[,\t;]/).map(function (s) { return s.trim(); });
  }

  function guessColumnUnit(values) {
    var vals = values.filter(function (v) { return isFinite(v); });
    if (!vals.length) return "nm";
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);
    if (max <= 50) return "eV";
    if (min >= 2000) return "cm-1";
    return "nm";
  }

  var IMPORT_PREVIEW_CAP = 60;
  var pendingImport = null; // { lines, cells, included, headers, target, sourceLabel, source, unitTouched }

  function loadFileIntoRow(file, existingTarget) {
    var reader = new FileReader();
    reader.onload = function () {
      openImportModal(String(reader.result), file.name, "file", existingTarget);
    };
    reader.onerror = function () {
      if (existingTarget) setRowStatus(existingTarget.row, "Could not read that file.", true);
      else setStatus("Could not read that file.", true);
    };
    reader.readAsText(file);
  }

  function openImportModal(text, sourceLabel, source, existingTarget) {
    var lines = text.split(/\r\n|\n|\r/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    var cells = lines.map(splitDelimited);
    var included = cells.map(isNumericRow);

    pendingImport = {
      lines: lines, cells: cells, included: included, headers: null,
      target: existingTarget || null, sourceLabel: sourceLabel, source: source,
      unitTouched: false
    };

    importModalSourceEl.textContent = "Source: " + sourceLabel + " — uncheck any rows that aren't part of the data table.";
    importModeSelect.value = spectrumMode;
    renderImportPreview();
    recomputeImportConfig();
    importModalOverlay.hidden = false;
  }

  function closeImportModal() {
    importModalOverlay.hidden = true;
    pendingImport = null;
  }

  function renderImportPreview() {
    var p = pendingImport;
    importPreviewBody.innerHTML = "";
    var shown = Math.min(p.lines.length, IMPORT_PREVIEW_CAP);
    for (var i = 0; i < shown; i++) {
      (function (i) {
        var tr = document.createElement("tr");
        tr.className = "spectra-import-preview-row" + (p.included[i] ? "" : " excluded");

        var cbTd = document.createElement("td");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = p.included[i];
        cb.addEventListener("change", function () {
          p.included[i] = cb.checked;
          tr.className = "spectra-import-preview-row" + (cb.checked ? "" : " excluded");
          recomputeImportConfig();
        });
        cbTd.appendChild(cb);

        var numTd = document.createElement("td");
        numTd.textContent = String(i + 1);

        var textTd = document.createElement("td");
        textTd.textContent = p.lines[i];

        tr.appendChild(cbTd);
        tr.appendChild(numTd);
        tr.appendChild(textTd);
        importPreviewBody.appendChild(tr);
      })(i);
    }
    if (p.lines.length > shown) {
      importPreviewMoreEl.hidden = false;
      importPreviewMoreEl.textContent = "+ " + (p.lines.length - shown) + " more line(s) below — numeric rows among them are included automatically.";
    } else {
      importPreviewMoreEl.hidden = true;
    }
  }

  function includedNumericRows(p) {
    var numCols = null;
    var rows = [];
    var firstDataIdx = -1;
    for (var i = 0; i < p.lines.length; i++) {
      if (!p.included[i]) continue;
      var c = p.cells[i];
      if (!isNumericRow(c)) continue;
      if (numCols === null) { numCols = c.length; firstDataIdx = i; }
      if (c.length !== numCols) continue;
      rows.push(c.map(function (v) { return parseFloat(v); }));
    }
    var headers = null;
    if (firstDataIdx > 0 && numCols) {
      var candidate = p.cells[firstDataIdx - 1];
      if (!isNumericRow(candidate) && candidate.length === numCols) headers = candidate;
    }
    return { numCols: numCols || 0, rows: rows, headers: headers };
  }

  function recomputeImportConfig() {
    var p = pendingImport;
    var found = includedNumericRows(p);
    p.headers = found.headers;
    var prevXCol = importXColSelect.value !== "" ? parseInt(importXColSelect.value, 10) : 0;

    importXColSelect.innerHTML = "";
    for (var c = 0; c < found.numCols; c++) {
      var opt = document.createElement("option");
      opt.value = String(c);
      var headerName = p.headers && p.headers[c] ? p.headers[c] : null;
      opt.textContent = "Column " + (c + 1) + (headerName ? " — " + headerName : "");
      importXColSelect.appendChild(opt);
    }
    var xCol = (found.numCols && prevXCol < found.numCols) ? prevXCol : 0;
    importXColSelect.value = String(xCol);

    if (!p.unitTouched) {
      var xVals = found.rows.map(function (r) { return r[xCol]; });
      importUnitSelect.value = guessColumnUnit(xVals);
    }

    var yCols = Math.max(found.numCols - 1, 0);
    importSummaryEl.textContent = found.rows.length
      ? "Detected " + found.rows.length + " data point(s), " + yCols + " sample column" + (yCols === 1 ? "" : "s") + "."
      : "No numeric data rows detected yet — check the rows that contain your data.";
    importLoadBtn.disabled = !found.rows.length || found.numCols < 2;
  }

  importXColSelect.addEventListener("change", function () { recomputeImportConfig(); });
  importUnitSelect.addEventListener("change", function () { if (pendingImport) pendingImport.unitTouched = true; });

  function commitImport() {
    var p = pendingImport;
    var found = includedNumericRows(p);
    if (!found.rows.length || found.numCols < 2) return;

    var xCol = parseInt(importXColSelect.value, 10) || 0;
    var unit = importUnitSelect.value;
    var mode = importModeSelect.value;
    if (mode !== spectrumMode) {
      spectrumMode = mode;
      modeSelect.value = mode;
    }

    var rows = found.rows.slice().sort(function (a, b) { return a[xCol] - b[xCol]; });
    var xNm = rows.map(function (r) { return convertToNm(r[xCol], unit); });
    var yCols = [];
    for (var c = 0; c < found.numCols; c++) { if (c !== xCol) yCols.push(c); }

    var touchedIds = [];
    var labels = [];
    var firstRow = null;

    yCols.forEach(function (col, idx) {
      var y = rows.map(function (r) { return r[col]; });
      var headerName = p.headers && p.headers[col] ? p.headers[col] : null;
      var label = headerName || (yCols.length > 1 ? "Sample " + (idx + 1) : p.sourceLabel);
      labels.push(label);

      var targetDs, targetRow;
      if (idx === 0 && p.target) {
        targetDs = p.target.ds; targetRow = p.target.row;
      } else if (idx === 0 && !p.target) {
        var emptyDs = findEmptyDataset();
        if (emptyDs) {
          targetDs = emptyDs; targetRow = datasetsContainer.querySelector('[data-ds-id="' + emptyDs.id + '"]');
        } else {
          var added = addDataset();
          targetDs = added.ds; targetRow = added.row;
        }
      } else {
        var addedNext = addDataset();
        targetDs = addedNext.ds; targetRow = addedNext.row;
      }

      if (!firstRow) firstRow = targetRow;
      targetDs.xNm = xNm.slice();
      targetDs.y = y;
      targetDs.colUnit = unit;
      targetDs.source = p.source;
      touchedIds.push(targetDs.id);
      targetRow.querySelector('[data-role="col-unit"]').value = unit;
      var legendEl = targetRow.querySelector('[data-role="legend"]');
      if (!legendEl.value.trim()) legendEl.value = label;
      targetDs.label = legendEl.value;
    });

    removeStaleExampleRows(touchedIds);

    var msg = yCols.length > 1
      ? "Loaded " + yCols.length + " spectra from " + p.sourceLabel + " (" + labels.join(", ") + "), " + rows.length + " points each."
      : "Loaded " + p.sourceLabel + " (" + rows.length + " points).";
    setRowStatus(firstRow, msg, false);

    closeImportModal();
    draw();
  }

  importLoadBtn.addEventListener("click", commitImport);
  importCancelBtn.addEventListener("click", closeImportModal);
  importModalCloseBtn.addEventListener("click", closeImportModal);
  importModalOverlay.addEventListener("click", function (e) {
    if (e.target === importModalOverlay) closeImportModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !importModalOverlay.hidden) closeImportModal();
  });

  function paletteColorFor(idx) {
    return OKABE_ITO[idx % OKABE_ITO.length];
  }

  function createDataset() {
    var idx = datasetIdCounter++;
    var ds = {
      id: "ds" + idx,
      xNm: [], y: [], label: "",
      color: paletteColorFor(idx),
      colorAuto: true,
      paletteIndex: idx % OKABE_ITO.length,
      offset: 0,
      normalize: "none",
      lineStyle: "solid",
      fillArea: true,
      visible: true,
      colUnit: "nm",
      source: null,
      selectedPeakIndices: [],
      subtractDatasetId: null
    };
    datasets.push(ds);
    return ds;
  }

  function removeDataset(ds) {
    datasets.forEach(function (d) {
      if (d.subtractDatasetId === ds.id) d.subtractDatasetId = null;
    });
    var idx = datasets.indexOf(ds);
    if (idx !== -1) datasets.splice(idx, 1);
  }

  function removeStaleExampleRows(excludeIds) {
    datasets.slice().forEach(function (d) {
      if (d.source === "example" && excludeIds.indexOf(d.id) === -1) {
        var staleRow = datasetsContainer.querySelector('[data-ds-id="' + d.id + '"]');
        removeDataset(d);
        if (staleRow) staleRow.remove();
      }
    });
    if (!datasets.length) setStatus("No spectra loaded.", false);
  }

  function buildProjectPayload() {
    return {
      version: 1,
      spectrumMode: spectrumMode,
      axisUnit: axisUnitSelect.value,
      custom: custom,
      datasets: datasets.map(function (d) {
        var subtractIndex = d.subtractDatasetId
          ? datasets.findIndex(function (x) { return x.id === d.subtractDatasetId; })
          : -1;
        return {
          label: d.label, color: d.color, colorAuto: d.colorAuto, paletteIndex: d.paletteIndex,
          offset: d.offset, normalize: d.normalize, lineStyle: d.lineStyle, fillArea: d.fillArea, visible: d.visible,
          colUnit: d.colUnit, source: d.source, xNm: d.xNm, y: d.y,
          selectedPeakIndices: d.selectedPeakIndices || [],
          subtractIndex: subtractIndex
        };
      })
    };
  }

  function makeBlankProject() {
    return { version: 1, spectrumMode: "absorption", axisUnit: "nm", custom: makeDefaultCustom(), datasets: [] };
  }

  function restoreProjectPayload(project) {
    datasets.length = 0;
    datasetsContainer.innerHTML = "";

    var c = project.custom || {};
    titleInput.value = c.title || "";
    bgModeSelect.value = c.bgMode || "transparent";
    bgCustomInput.value = c.bgCustomColor || "#ffffff";
    bgCustomWrap.hidden = bgModeSelect.value !== "custom";
    closedBoxInput.checked = c.closedBox !== false;
    xGridInput.checked = c.showXGrid !== false;
    yGridInput.checked = c.showYGrid !== false;
    xMinInput.value = c.xMin != null ? c.xMin : "";
    xMaxInput.value = c.xMax != null ? c.xMax : "";
    xStepInput.value = c.xStep != null ? c.xStep : "";
    yMinInput.value = c.yMin != null ? c.yMin : "";
    yMaxInput.value = c.yMax != null ? c.yMax : "";
    yStepInput.value = c.yStep != null ? c.yStep : "";
    xGridOpacityInput.value = c.xGridOpacity != null ? c.xGridOpacity : 0.15;
    yGridOpacityInput.value = c.yGridOpacity != null ? c.yGridOpacity : 0.5;
    legendPositionSelect.value = c.legendPosition || "top-right";
    xAxisLabelInput.value = c.xAxisLabelOverride || "";
    yAxisLabelInput.value = c.yAxisLabelOverride || "";
    readCustom();

    spectrumMode = project.spectrumMode === "fluorescence" ? "fluorescence" : "absorption";
    modeSelect.value = spectrumMode;
    if (project.axisUnit) axisUnitSelect.value = project.axisUnit;

    var addedDatasets = [];
    (project.datasets || []).forEach(function (saved) {
      var added = addDataset();
      var ds = added.ds, row = added.row;
      addedDatasets.push(ds);
      ds.xNm = saved.xNm || [];
      ds.y = saved.y || [];
      ds.label = saved.label || "";
      ds.color = saved.color || ds.color;
      ds.colorAuto = !!saved.colorAuto;
      ds.offset = saved.offset || 0;
      ds.normalize = saved.normalize || "none";
      ds.lineStyle = saved.lineStyle || "solid";
      ds.fillArea = saved.fillArea !== false;
      ds.visible = saved.visible !== false;
      ds.colUnit = saved.colUnit || "nm";
      ds.source = saved.source || null;
      ds.selectedPeakIndices = Array.isArray(saved.selectedPeakIndices) ? saved.selectedPeakIndices : [];

      row.querySelector('[data-role="color"]').value = ds.color;
      row.querySelector('[data-role="legend"]').value = ds.label;
      row.querySelector('[data-role="col-unit"]').value = ds.colUnit;
      row.querySelector('[data-role="offset"]').value = ds.offset;
      row.querySelector('[data-role="normalize"]').value = ds.normalize;
      row.querySelector('[data-role="line-style"]').value = ds.lineStyle;
      row.querySelector('[data-role="fill-area"]').checked = ds.fillArea;
      row.querySelector('[data-role="visible"]').checked = ds.visible;
    });

    (project.datasets || []).forEach(function (saved, idx) {
      if (saved.subtractIndex != null && saved.subtractIndex >= 0 && addedDatasets[saved.subtractIndex]) {
        addedDatasets[idx].subtractDatasetId = addedDatasets[saved.subtractIndex].id;
      }
    });

    draw();
  }

  function scheduleFolderPersist() {
    if (!activeFolderId) return;
    if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
    persistDebounceTimer = setTimeout(persistActiveFolder, 500);
  }

  function persistActiveFolder() {
    if (persistDebounceTimer) { clearTimeout(persistDebounceTimer); persistDebounceTimer = null; }
    if (!activeFolderId) return;
    var folder = folders.find(function (f) { return f.id === activeFolderId; });
    if (!folder) return;
    folder.data = buildProjectPayload();
    folder.updatedAt = Date.now();
    dbPutFolder(folder);
  }

  function setLastFolderId(id) {
    try {
      if (id) localStorage.setItem("spectrawave-last-folder", id);
      else localStorage.removeItem("spectrawave-last-folder");
    } catch (e) { /* private-mode storage may throw; non-fatal */ }
  }

  function activateFolder(id) {
    if (id === activeFolderId) return;
    persistActiveFolder();
    var folder = folders.find(function (f) { return f.id === id; });
    if (!folder) return;
    activeFolderId = folder.id;
    setLastFolderId(folder.id);
    restoreProjectPayload(folder.data);
    renderFolderTree();
  }

  function createFolder(parentId) {
    var name = window.prompt(parentId ? "Sub-folder name:" : "Molecule folder name:", "");
    if (!name || !name.trim()) return;

    var seedData = activeFolderId === null ? buildProjectPayload() : makeBlankProject();
    persistActiveFolder();

    var folder = {
      id: "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      parentId: parentId || null,
      updatedAt: Date.now(),
      data: seedData
    };
    folders.push(folder);
    dbPutFolder(folder);

    activeFolderId = folder.id;
    setLastFolderId(folder.id);
    restoreProjectPayload(folder.data);
    renderFolderTree();
  }

  function renameFolder(id) {
    var folder = folders.find(function (f) { return f.id === id; });
    if (!folder) return;
    var name = window.prompt("Rename folder:", folder.name);
    if (!name || !name.trim()) return;
    folder.name = name.trim();
    folder.updatedAt = Date.now();
    dbPutFolder(folder);
    renderFolderTree();
  }

  function collectDescendantIds(id) {
    var ids = [id];
    folders.forEach(function (f) {
      if (f.parentId === id) ids = ids.concat(collectDescendantIds(f.id));
    });
    return ids;
  }

  function deleteFolder(id) {
    var folder = folders.find(function (f) { return f.id === id; });
    if (!folder) return;
    var toDelete = collectDescendantIds(id);
    var label = toDelete.length > 1
      ? "this folder and its " + (toDelete.length - 1) + " sub-folder(s)"
      : "this folder";
    if (!window.confirm("Delete " + label + " (\"" + folder.name + "\")?")) return;

    var deletedSnapshot = folders.filter(function (f) { return toDelete.indexOf(f.id) !== -1; });

    folders = folders.filter(function (f) { return toDelete.indexOf(f.id) === -1; });
    toDelete.forEach(function (fid) { dbDeleteFolder(fid); });

    if (toDelete.indexOf(activeFolderId) !== -1) {
      if (folders.length) {
        var next = folders.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
        activeFolderId = next.id;
        setLastFolderId(next.id);
        restoreProjectPayload(next.data);
      } else {
        activeFolderId = null;
        setLastFolderId(null);
        restoreProjectPayload(makeBlankProject());
        setStatus("No spectra loaded.", false);
      }
    }
    renderFolderTree();

    showUndoToast(
      "Deleted \"" + folder.name + "\"" + (toDelete.length > 1 ? " and " + (toDelete.length - 1) + " sub-folder(s)" : "") + ".",
      function () {
        deletedSnapshot.forEach(function (f) {
          folders.push(f);
          dbPutFolder(f);
        });
        renderFolderTree();
      }
    );
  }

  function getVisibleFolderIds(filterText) {
    if (!filterText) return null;
    var lower = filterText.toLowerCase();
    var visible = {};
    folders.forEach(function (f) {
      if (f.name.toLowerCase().indexOf(lower) === -1) return;
      var cur = f;
      while (cur) {
        visible[cur.id] = true;
        cur = cur.parentId ? folders.find(function (x) { return x.id === cur.parentId; }) : null;
      }
    });
    return visible;
  }

  function renderFolderTree() {
    folderTreeEl.innerHTML = "";

    if (!folders.length) {
      folderSearchInput.hidden = true;
      var empty = document.createElement("p");
      empty.className = "hint spectra-folder-empty-hint";
      empty.textContent = "No projects yet — click \"+ Folder\" to organize spectra by molecule.";
      folderTreeEl.appendChild(empty);
      return;
    }
    folderSearchInput.hidden = false;

    var visibleIds = getVisibleFolderIds(folderSearchInput.value.trim());

    function renderNode(folder, depth) {
      if (visibleIds && !visibleIds[folder.id]) return;

      var row = document.createElement("div");
      row.className = "spectra-folder-row" + (folder.id === activeFolderId ? " active" : "");
      row.style.paddingLeft = (depth * 14) + "px";

      var nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "spectra-folder-name-btn";
      nameBtn.textContent = folder.name;
      nameBtn.title = "Open " + folder.name;
      nameBtn.addEventListener("click", function () { activateFolder(folder.id); });
      row.appendChild(nameBtn);

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "spectra-folder-icon-btn";
      addBtn.textContent = "+";
      addBtn.title = "Add sub-folder";
      addBtn.setAttribute("aria-label", "Add sub-folder to " + folder.name);
      addBtn.addEventListener("click", function (e) { e.stopPropagation(); createFolder(folder.id); });
      row.appendChild(addBtn);

      var renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "spectra-folder-icon-btn";
      renameBtn.textContent = "✎";
      renameBtn.title = "Rename";
      renameBtn.setAttribute("aria-label", "Rename " + folder.name);
      renameBtn.addEventListener("click", function (e) { e.stopPropagation(); renameFolder(folder.id); });
      row.appendChild(renameBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "spectra-folder-icon-btn spectra-folder-delete-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete";
      delBtn.setAttribute("aria-label", "Delete " + folder.name);
      delBtn.addEventListener("click", function (e) { e.stopPropagation(); deleteFolder(folder.id); });
      row.appendChild(delBtn);

      folderTreeEl.appendChild(row);

      var children = folders.filter(function (f) { return f.parentId === folder.id; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      children.forEach(function (child) { renderNode(child, depth + 1); });
    }

    folders.filter(function (f) { return !f.parentId; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (f) { renderNode(f, 0); });

    if (visibleIds && !Object.keys(visibleIds).length) {
      var noMatch = document.createElement("p");
      noMatch.className = "hint spectra-folder-empty-hint";
      noMatch.textContent = "No folders match \"" + folderSearchInput.value.trim() + "\".";
      folderTreeEl.appendChild(noMatch);
    }
  }

  function createDatasetRow(ds) {
    var frag = rowTemplate.content.cloneNode(true);
    var row = frag.querySelector(".spectra-dataset-row");
    row.dataset.dsId = ds.id;

    var colorInput = row.querySelector('[data-role="color"]');
    var legendInput = row.querySelector('[data-role="legend"]');
    var fileInput = row.querySelector('[data-role="file-input"]');
    var pasteToggleBtn = row.querySelector('[data-role="paste-toggle-btn"]');
    var pasteTextarea = row.querySelector('[data-role="paste-textarea"]');
    var pasteLoadBtn = row.querySelector('[data-role="paste-load-btn"]');
    var colUnitSelect = row.querySelector('[data-role="col-unit"]');
    var offsetInput = row.querySelector('[data-role="offset"]');
    var subtractSelect = row.querySelector('[data-role="subtract"]');
    var normalizeSelect = row.querySelector('[data-role="normalize"]');
    var lineStyleSelect = row.querySelector('[data-role="line-style"]');
    var fillAreaInput = row.querySelector('[data-role="fill-area"]');
    var visibleInput = row.querySelector('[data-role="visible"]');
    var findPeaksBtn = row.querySelector('[data-role="find-peaks-btn"]');
    var peaksPanel = row.querySelector('[data-role="peaks-panel"]');
    var peaksSensitivity = row.querySelector('[data-role="peaks-sensitivity"]');
    var peaksList = row.querySelector('[data-role="peaks-list"]');
    var downloadBtn = row.querySelector('[data-role="download-btn"]');
    var removeBtn = row.querySelector('[data-role="remove-btn"]');
    var editDataBtn = row.querySelector('[data-role="edit-data-btn"]');
    var editDataPanel = row.querySelector('[data-role="edit-data-panel"]');
    var editDataTableWrap = row.querySelector('[data-role="edit-data-table-wrap"]');
    var editDataAddBtn = row.querySelector('[data-role="edit-data-add-btn"]');

    colorInput.value = ds.color;
    lineStyleSelect.value = ds.lineStyle;
    fillAreaInput.checked = ds.fillArea;

    function renderPeaksList() {
      var y = displayY(ds);
      var candidates = findPeaks(y, parseFloat(peaksSensitivity.value));
      var candidateIndices = candidates.map(function (p) { return p.index; });
      ds.selectedPeakIndices = (ds.selectedPeakIndices || []).filter(function (idx) {
        return candidateIndices.indexOf(idx) !== -1;
      });
      peaksList.innerHTML = "";
      if (!candidates.length) {
        var none = document.createElement("p");
        none.className = "hint";
        none.textContent = "No peaks found at this sensitivity.";
        peaksList.appendChild(none);
      }
      candidates.slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (p) {
        var label = document.createElement("label");
        label.className = "spectra-checkbox-field";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = ds.selectedPeakIndices.indexOf(p.index) !== -1;
        cb.addEventListener("change", function () {
          var pos = ds.selectedPeakIndices.indexOf(p.index);
          if (cb.checked && pos === -1) ds.selectedPeakIndices.push(p.index);
          if (!cb.checked && pos !== -1) ds.selectedPeakIndices.splice(pos, 1);
          draw();
        });
        var unit = axisUnitSelect.value;
        var xv = convertFromNm(ds.xNm[p.index], unit);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(" " + formatVal(xv, unit) + " " + unitLabel(unit) + ", value " + y[p.index].toFixed(3)));
        peaksList.appendChild(label);
      });
      draw();
    }

    findPeaksBtn.addEventListener("click", function () {
      peaksPanel.hidden = !peaksPanel.hidden;
      if (!peaksPanel.hidden) renderPeaksList();
    });

    peaksSensitivity.addEventListener("input", function () {
      if (!peaksPanel.hidden) renderPeaksList();
    });

    colorInput.addEventListener("input", function () {
      ds.color = colorInput.value;
      ds.colorAuto = false;
      draw();
    });

    legendInput.addEventListener("input", function () {
      ds.label = legendInput.value;
      draw();
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      if (!file) return;
      loadFileIntoRow(file, { ds: ds, row: row });
      fileInput.value = "";
    });

    pasteToggleBtn.addEventListener("click", function () {
      var showing = !pasteTextarea.hidden;
      pasteTextarea.hidden = showing;
      pasteLoadBtn.hidden = showing;
      if (!showing) pasteTextarea.focus();
    });

    pasteLoadBtn.addEventListener("click", function () {
      if (!pasteTextarea.value.trim()) { setRowStatus(row, "Paste some data first.", true); return; }
      openImportModal(pasteTextarea.value, "pasted data", "paste", { ds: ds, row: row });
    });

    offsetInput.addEventListener("input", function () {
      var v = parseFloat(offsetInput.value);
      ds.offset = isFinite(v) ? v : 0;
      draw();
    });

    subtractSelect.addEventListener("change", function () {
      ds.subtractDatasetId = subtractSelect.value || null;
      draw();
    });

    normalizeSelect.addEventListener("change", function () {
      ds.normalize = normalizeSelect.value;
      draw();
    });

    lineStyleSelect.addEventListener("change", function () {
      ds.lineStyle = lineStyleSelect.value;
      draw();
    });

    fillAreaInput.addEventListener("change", function () {
      ds.fillArea = fillAreaInput.checked;
      draw();
    });

    visibleInput.addEventListener("change", function () {
      ds.visible = visibleInput.checked;
      draw();
    });

    downloadBtn.addEventListener("click", function () {
      if (!ds.xNm.length) return;
      var unit = axisUnitSelect.value;
      var rows = [[unitLabel(unit), yValueLabel()]];
      ds.xNm.forEach(function (nm, i) {
        rows.push([convertFromNm(nm, unit).toFixed(unit === "nm" ? 2 : 4), ds.y[i]]);
      });
      var csv = rows.map(function (r) { return r.join(","); }).join("\r\n");
      var safeName = ((ds.label || "spectrum").trim() || "spectrum").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      downloadBlob(safeName + "-" + unit.replace("-", "") + ".csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    });

    function renderEditDataTable() {
      editDataTableWrap.innerHTML = "";
      var unit = colUnitSelect.value;
      var table = document.createElement("table");
      var thead = document.createElement("thead");
      var headRow = document.createElement("tr");
      [unitLabel(unit), "Value", ""].forEach(function (text) {
        var th = document.createElement("th");
        th.textContent = text;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      ds.xNm.forEach(function (nm, i) {
        var tr = document.createElement("tr");

        var xTd = document.createElement("td");
        var xInput = document.createElement("input");
        xInput.type = "number";
        xInput.step = "any";
        xInput.value = convertFromNm(nm, unit);
        xInput.addEventListener("change", function () {
          var v = parseFloat(xInput.value);
          if (!isFinite(v)) return;
          ds.xNm[i] = convertToNm(v, unit);
          var pairs = ds.xNm.map(function (n, j) { return [n, ds.y[j]]; });
          pairs.sort(function (a, b) { return a[0] - b[0]; });
          ds.xNm = pairs.map(function (p) { return p[0]; });
          ds.y = pairs.map(function (p) { return p[1]; });
          renderEditDataTable();
          draw();
        });
        xTd.appendChild(xInput);

        var yTd = document.createElement("td");
        var yInput = document.createElement("input");
        yInput.type = "number";
        yInput.step = "any";
        yInput.value = ds.y[i];
        yInput.addEventListener("change", function () {
          var v = parseFloat(yInput.value);
          if (!isFinite(v)) return;
          ds.y[i] = v;
          draw();
        });
        yTd.appendChild(yInput);

        var rmTd = document.createElement("td");
        var rmBtn = document.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "spectra-editdata-row-remove";
        rmBtn.title = "Remove this point";
        rmBtn.setAttribute("aria-label", "Remove this point");
        rmBtn.textContent = "×";
        rmBtn.addEventListener("click", function () {
          ds.xNm.splice(i, 1);
          ds.y.splice(i, 1);
          renderEditDataTable();
          draw();
        });
        rmTd.appendChild(rmBtn);

        tr.appendChild(xTd);
        tr.appendChild(yTd);
        tr.appendChild(rmTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      editDataTableWrap.appendChild(table);
    }

    editDataBtn.addEventListener("click", function () {
      editDataPanel.hidden = !editDataPanel.hidden;
      if (!editDataPanel.hidden) renderEditDataTable();
    });

    editDataAddBtn.addEventListener("click", function () {
      var lastNm = ds.xNm.length ? ds.xNm[ds.xNm.length - 1] : convertToNm(0, colUnitSelect.value);
      ds.xNm.push(lastNm);
      ds.y.push(0);
      renderEditDataTable();
      draw();
    });

    removeBtn.addEventListener("click", function () {
      var idx = datasets.indexOf(ds);
      removeDataset(ds);
      row.remove();
      if (!datasets.length) setStatus("No spectra loaded.", false);
      draw();
      showUndoToast("Removed \"" + ((ds.label && ds.label.trim()) || "spectrum") + "\".", function () {
        datasets.splice(idx, 0, ds);
        datasetsContainer.insertBefore(row, datasetsContainer.children[idx] || null);
        draw();
      });
    });

    datasetsContainer.appendChild(frag);
    return row;
  }

  function addDataset() {
    var ds = createDataset();
    var row = createDatasetRow(ds);
    return { ds: ds, row: row };
  }

  addDatasetBtn.addEventListener("click", function () {
    addDataset();
    setStatus("", false);
  });

  bgModeSelect.addEventListener("change", function () {
    bgCustomWrap.hidden = bgModeSelect.value !== "custom";
    readCustom();
    draw();
  });

  [titleInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput, bgCustomInput,
    xAxisLabelInput, yAxisLabelInput, xGridOpacityInput, yGridOpacityInput].forEach(function (el) {
    el.addEventListener("input", function () {
      readCustom();
      draw();
    });
  });

  [closedBoxInput, xGridInput, yGridInput, legendPositionSelect].forEach(function (el) {
    el.addEventListener("change", function () {
      readCustom();
      draw();
    });
  });

  axisUnitSelect.addEventListener("change", function () {
    xMinInput.value = ""; xMaxInput.value = ""; xStepInput.value = "";
    readCustom();
    draw();
  });

  modeSelect.addEventListener("change", function () {
    spectrumMode = modeSelect.value;
    draw();
  });

  resetAxesBtn.addEventListener("click", function () {
    [titleInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput, xAxisLabelInput, yAxisLabelInput].forEach(function (el) {
      el.value = "";
    });
    readCustom();
    draw();
  });

  pngBtn.addEventListener("click", function () {
    renderHighResPngBlob(function (blob) {
      downloadBlob("absorption-spectrum.png", blob);
    });
  });

  svgBtn.addEventListener("click", function () {
    var width = canvas.clientWidth || 600, height = 360;
    var theme = readThemeColors();
    var svgStr = buildSvgString(width, height, datasets, axisUnitSelect.value, custom, theme);
    downloadBlob("absorption-spectrum.svg", new Blob([svgStr], { type: "image/svg+xml;charset=utf-8;" }));
  });

  function escapeCsvCell(cell) {
    var s = String(cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildVisibleDataCsv() {
    var unit = axisUnitSelect.value;
    var rows = [["Spectrum", unitLabel(unit), yValueLabel()]];
    var xMin = custom.xMin, xMax = custom.xMax;
    var any = false;
    datasets.forEach(function (d) {
      if (!d.visible || !d.xNm.length) return;
      var label = (d.label && d.label.trim()) || "Spectrum";
      var dy = displayY(d);
      d.xNm.forEach(function (nm, i) {
        var xv = convertFromNm(nm, unit);
        if (xMin != null && xv < xMin - 1e-9) return;
        if (xMax != null && xv > xMax + 1e-9) return;
        rows.push([label, xv.toFixed(unit === "nm" ? 2 : 4), dy[i]]);
        any = true;
      });
    });
    if (!any) return null;
    return { unit: unit, csv: rows.map(function (r) { return r.map(escapeCsvCell).join(","); }).join("\r\n") };
  }

  dataBtn.addEventListener("click", function () {
    var result = buildVisibleDataCsv();
    if (!result) return;
    downloadBlob("spectra-visible-" + result.unit.replace("-", "") + ".csv", new Blob([result.csv], { type: "text/csv;charset=utf-8;" }));
  });

  (function () {
    if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return;
    try {
      var testFile = new File(["x"], "test.png", { type: "image/png" });
      if (navigator.canShare({ files: [testFile] })) shareGroupEl.hidden = false;
    } catch (e) { /* Web Share (files) unsupported here */ }
  })();

  shareBtn.addEventListener("click", function () {
    var mode = shareModeSelect.value;
    var files = [];

    function addImageAndShare() {
      renderHighResPngBlob(function (blob) {
        if (blob) files.push(new File([blob], "spectrum-chart.png", { type: "image/png" }));
        doShare();
      });
    }

    function doShare() {
      if (!files.length) { setStatus("Nothing to share yet — load a spectrum first.", true); return; }
      if (files.length > 1 && navigator.canShare && !navigator.canShare({ files: files })) {
        files = [files[0]];
      }
      var shareData = { files: files, title: (custom.title && custom.title.trim()) || "Spectrum chart", text: "Spectrum chart from SpectraWave" };
      if (navigator.canShare && !navigator.canShare(shareData)) {
        setStatus("Your browser can't share files directly — use the Download buttons instead.", true);
        return;
      }
      navigator.share(shareData).catch(function (e) {
        if (e && e.name !== "AbortError") setStatus("Couldn't share: " + e.message, true);
      });
    }

    if (mode === "data" || mode === "both") {
      var result = buildVisibleDataCsv();
      if (result) {
        files.push(new File([result.csv], "spectra-visible-" + result.unit.replace("-", "") + ".csv", { type: "text/csv" }));
      }
    }
    if (mode === "image" || mode === "both") {
      addImageAndShare();
    } else {
      doShare();
    }
  });

  function findEmptyDataset() {
    return datasets.find(function (d) { return !d.xNm.length; });
  }

  globalUploadInput.addEventListener("change", function () {
    var file = globalUploadInput.files[0];
    if (!file) return;
    loadFileIntoRow(file, null);
    globalUploadInput.value = "";
  });

  saveProjectBtn.addEventListener("click", function () {
    var project = buildProjectPayload();
    downloadBlob("spectrawave-project.json", new Blob([JSON.stringify(project)], { type: "application/json;charset=utf-8;" }));
  });

  loadProjectInput.addEventListener("change", function () {
    var file = loadProjectInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var project;
      try {
        project = JSON.parse(String(reader.result));
      } catch (e) {
        setStatus("Couldn't read that project file.", true);
        return;
      }
      if (!project || !Array.isArray(project.datasets)) {
        setStatus("That doesn't look like a SpectraWave project file.", true);
        return;
      }
      restoreProjectPayload(project);
      setStatus("Loaded project (" + datasets.length + " spectra).", false);
      loadProjectInput.value = "";
    };
    reader.onerror = function () { setStatus("Could not read that file.", true); };
    reader.readAsText(file);
  });

  clearBtn.addEventListener("click", function () {
    if (!datasets.length) return;
    if (!window.confirm("Remove all spectra?")) return;
    var snapshot = buildProjectPayload();
    datasets.length = 0;
    datasetsContainer.innerHTML = "";
    setStatus("No spectra loaded.", false);
    draw();
    showUndoToast("Cleared " + snapshot.datasets.length + " spectra.", function () {
      restoreProjectPayload(snapshot);
    });
  });

  newFolderBtn.addEventListener("click", function () {
    createFolder(null);
  });

  folderSearchInput.addEventListener("input", function () {
    renderFolderTree();
  });

  exportAllBtn.addEventListener("click", function () {
    if (!folders.length) { setFolderStatus("No projects to export yet.", true); return; }
    persistActiveFolder();
    var bundle = { version: 2, folders: folders };
    downloadBlob("spectrawave-workspace.json", new Blob([JSON.stringify(bundle)], { type: "application/json;charset=utf-8;" }));
  });

  importAllInput.addEventListener("change", function () {
    var file = importAllInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var bundle;
      try {
        bundle = JSON.parse(String(reader.result));
      } catch (e) {
        setFolderStatus("Couldn't read that workspace file.", true);
        return;
      }
      if (!bundle || !Array.isArray(bundle.folders)) {
        setFolderStatus("That doesn't look like a SpectraWave workspace file.", true);
        return;
      }
      if (!window.confirm("Import " + bundle.folders.length + " folder(s)? This merges with your existing projects.")) {
        importAllInput.value = "";
        return;
      }
      bundle.folders.forEach(function (f) {
        var idx = folders.findIndex(function (existing) { return existing.id === f.id; });
        if (idx !== -1) folders[idx] = f; else folders.push(f);
        dbPutFolder(f);
      });
      renderFolderTree();
      setFolderStatus("Imported " + bundle.folders.length + " folder(s).", false);
      importAllInput.value = "";
    };
    reader.onerror = function () { setFolderStatus("Could not read that file.", true); };
    reader.readAsText(file);
  });

  window.addEventListener("resize", draw);

  document.addEventListener("click", function (e) {
    document.querySelectorAll(".spectra-actions-menu[open]").forEach(function (menu) {
      if (!menu.contains(e.target)) menu.removeAttribute("open");
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".spectra-actions-menu[open]").forEach(function (menu) {
      menu.removeAttribute("open");
    });
  });

  document.querySelectorAll(".spectra-actions-menu").forEach(function (menu) {
    menu.addEventListener("toggle", function () {
      var panel = menu.querySelector(".spectra-actions-menu-panel");
      if (!panel) return;
      panel.style.left = "0";
      if (!menu.open) return;
      requestAnimationFrame(function () {
        var rect = panel.getBoundingClientRect();
        var overflowRight = rect.right - window.innerWidth;
        if (overflowRight > 0) {
          panel.style.left = (-overflowRight - 8) + "px";
        }
      });
    });
  });

  function loadDefaultDemoView() {
    var first = addDataset();
    var ex = generateExample();
    first.ds.xNm = ex.xNm;
    first.ds.y = ex.y;
    first.ds.source = "example";
    var legendInput = first.row.querySelector('[data-role="legend"]');
    legendInput.value = ex.label;
    first.ds.label = ex.label;
    setRowStatus(first.row, "Loaded " + ex.label + " (" + ex.xNm.length + " points). Approximate shape for demonstration — not measured data.", false);
    draw();
  }

  function initFoldersAndDefaultView() {
    if (typeof indexedDB === "undefined") {
      dbAvailable = false;
      setFolderStatus("Your browser doesn't support saved projects locally — use Save/Load project files instead.", false);
      loadDefaultDemoView();
      renderFolderTree();
      return;
    }
    openDb().then(function (db) {
      dbAvailable = true;
      dbInstance = db;
      return dbGetAllFolders();
    }).then(function (loaded) {
      folders = loaded || [];
      if (!folders.length) {
        loadDefaultDemoView();
      } else {
        var lastId = null;
        try { lastId = localStorage.getItem("spectrawave-last-folder"); } catch (e) { /* ignore */ }
        var target = folders.find(function (f) { return f.id === lastId; }) ||
          folders.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
        activeFolderId = target.id;
        restoreProjectPayload(target.data);
      }
      renderFolderTree();
    }).catch(function () {
      dbAvailable = false;
      setFolderStatus("Couldn't open local storage for projects — use Save/Load project files instead.", false);
      loadDefaultDemoView();
      renderFolderTree();
    });
  }

  initFoldersAndDefaultView();
})();

(function () {
  "use strict";

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav-link"));
  if (!navLinks.length || typeof IntersectionObserver === "undefined") return;

  var linkByHash = {};
  navLinks.forEach(function (link) {
    linkByHash[link.getAttribute("href")] = link;
  });

  function setActive(hash) {
    navLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  }

  var visibleRatios = {};
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      visibleRatios["#" + entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
    });
    var topHash = null, topRatio = 0;
    Object.keys(visibleRatios).forEach(function (hash) {
      if (visibleRatios[hash] > topRatio) { topRatio = visibleRatios[hash]; topHash = hash; }
    });
    if (topHash && linkByHash[topHash]) setActive(topHash);
  }, { rootMargin: "-" + "60px 0px -70% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });

  Object.keys(linkByHash).forEach(function (hash) {
    var section = document.querySelector(hash);
    if (section) observer.observe(section);
  });
})();
