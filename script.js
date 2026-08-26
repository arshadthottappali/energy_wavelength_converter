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

  var folderTreeEl = document.getElementById("spectra-folder-tree");
  var newFolderBtn = document.getElementById("spectra-new-folder-btn");
  var folderStatusEl = document.getElementById("spectra-folder-status");
  var exportAllBtn = document.getElementById("spectra-export-all-btn");
  var importAllInput = document.getElementById("spectra-import-all-input");

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

  var datasets = [];
  var datasetIdCounter = 0;
  var spectrumMode = "absorption";

  function makeDefaultCustom() {
    return {
      title: "", xMin: null, xMax: null, xStep: null, yMin: null, yMax: null, yStep: null,
      bgMode: "transparent", bgCustomColor: "#ffffff", closedBox: true, showXGrid: true, showYGrid: true
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
    return spectrumMode === "fluorescence" ? "Fluorescence Intensity (a.u.)" : "Absorbance (a.u.)";
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

  function displayY(ds) {
    return normalizeSeries(ds.y, ds.xNm, ds.normalize).map(function (v) { return v + ds.offset; });
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

  function draw() {
    scheduleFolderPersist();
    var dims = layout();
    var width = dims.width, height = dims.height;
    var bottomUnit = axisUnitSelect.value;
    var theme = readThemeColors();
    var fontFamily = getComputedStyle(document.body).fontFamily;

    ctx.clearRect(0, 0, width, height);

    var bgColor = resolveBackgroundColor(custom.bgMode, custom.bgCustomColor, theme.bgElev);
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    var L = computeChartLayout(width, height, datasets, bottomUnit, custom);
    plotBox = L;

    if (!L.visible.length) {
      ctx.fillStyle = theme.text;
      ctx.font = "13px " + fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No spectra loaded", width / 2, height / 2);
      return;
    }

    ctx.font = "11px " + fontFamily;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    L.yTicks.forEach(function (t) {
      if (custom.showYGrid) {
        ctx.beginPath();
        ctx.moveTo(L.left, t.px);
        ctx.lineTo(L.right, t.px);
        ctx.strokeStyle = theme.grid;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = theme.text;
      ctx.fillText(t.value.toFixed(2), L.left - 8, t.px);
      if (custom.closedBox) {
        ctx.beginPath();
        ctx.moveTo(L.right, t.px);
        ctx.lineTo(L.right - 5, t.px);
        ctx.strokeStyle = theme.text;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    L.xTicks.forEach(function (t) {
      if (custom.showXGrid) {
        ctx.beginPath();
        ctx.moveTo(t.px, L.top);
        ctx.lineTo(t.px, L.bottom);
        ctx.strokeStyle = theme.grid;
        ctx.globalAlpha = 0.15;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = theme.text;
      ctx.fillText(formatVal(t.value, L.bottomUnit), t.px, L.bottom + 8);
    });

    ctx.textBaseline = "bottom";
    L.topTicks.forEach(function (t) {
      ctx.beginPath();
      ctx.moveTo(t.px, L.top);
      ctx.lineTo(t.px, L.top - 5);
      ctx.strokeStyle = theme.text;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.text;
      ctx.fillText(formatVal(t.value, L.topUnit), t.px, L.top - 7);
    });

    ctx.strokeStyle = theme.grid;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(L.left, L.top);
    ctx.lineTo(L.left, L.bottom);
    ctx.lineTo(L.right, L.bottom);
    if (custom.closedBox) {
      ctx.lineTo(L.right, L.top);
      ctx.lineTo(L.left, L.top);
    }
    ctx.stroke();

    ctx.fillStyle = theme.strongText;
    ctx.font = "12px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(unitLabel(L.bottomUnit), (L.left + L.right) / 2, height - 8);
    ctx.fillText(unitLabel(L.topUnit), (L.left + L.right) / 2, 32);

    ctx.save();
    ctx.translate(14, (L.top + L.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(yAxisTitle(), 0, 0);
    ctx.restore();

    if (custom.title && custom.title.trim()) {
      ctx.fillStyle = theme.strongText;
      ctx.font = "bold 13px " + fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(custom.title.trim(), width / 2, 16);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(L.left, L.top, L.plotW, L.plotH);
    ctx.clip();
    L.visible.forEach(function (d) {
      var dy = displayY(d);
      ctx.beginPath();
      d.xNm.forEach(function (nm, i) {
        var xv = convertFromNm(nm, L.bottomUnit);
        var px = L.xPix(xv), py = L.yPix(dy[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dashArrayFor(d.lineStyle));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.lineTo(L.xPix(convertFromNm(d.xNm[d.xNm.length - 1], L.bottomUnit)), L.bottom);
      ctx.lineTo(L.xPix(convertFromNm(d.xNm[0], L.bottomUnit)), L.bottom);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    ctx.font = "11px " + fontFamily;
    var chipY = L.top + 6;
    L.visible.forEach(function (d) {
      var legendText = (d.label && d.label.trim()) || "Spectrum";
      var boxW = legendChipWidth(ctx, legendText, "11px " + fontFamily);
      var bx = L.right - boxW - 6, by = chipY;
      ctx.fillStyle = theme.bgElev;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, by, boxW, 20);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dashArrayFor(d.lineStyle));
      ctx.beginPath();
      ctx.moveTo(bx + 6, by + 10);
      ctx.lineTo(bx + 20, by + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.strongText;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(legendText, bx + 26, by + 10);
      chipY += 24;
    });
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
        parts.push('<line x1="' + L.left + '" y1="' + t.px + '" x2="' + L.right + '" y2="' + t.px + '" stroke="' + theme.grid + '" stroke-opacity="0.5"/>');
      }
      parts.push('<text x="' + (L.left - 8) + '" y="' + t.px + '" text-anchor="end" dominant-baseline="middle" fill="' + theme.text + '" font-size="11">' + t.value.toFixed(2) + '</text>');
      if (customSettings.closedBox) {
        parts.push('<line x1="' + L.right + '" y1="' + t.px + '" x2="' + (L.right - 5) + '" y2="' + t.px + '" stroke="' + theme.text + '" stroke-opacity="0.6"/>');
      }
    });

    L.xTicks.forEach(function (t) {
      if (customSettings.showXGrid) {
        parts.push('<line x1="' + t.px + '" y1="' + L.top + '" x2="' + t.px + '" y2="' + L.bottom + '" stroke="' + theme.grid + '" stroke-opacity="0.15"/>');
      }
      parts.push('<text x="' + t.px + '" y="' + (L.bottom + 8) + '" text-anchor="middle" dominant-baseline="hanging" fill="' + theme.text + '" font-size="11">' + escapeHtml(formatVal(t.value, L.bottomUnit)) + '</text>');
    });

    L.topTicks.forEach(function (t) {
      parts.push('<line x1="' + t.px + '" y1="' + L.top + '" x2="' + t.px + '" y2="' + (L.top - 5) + '" stroke="' + theme.text + '" stroke-opacity="0.6"/>');
      parts.push('<text x="' + t.px + '" y="' + (L.top - 7) + '" text-anchor="middle" fill="' + theme.text + '" font-size="11">' + escapeHtml(formatVal(t.value, L.topUnit)) + '</text>');
    });

    var boxPath = "M" + L.left + " " + L.top + " L" + L.left + " " + L.bottom + " L" + L.right + " " + L.bottom;
    if (customSettings.closedBox) boxPath += " L" + L.right + " " + L.top + " L" + L.left + " " + L.top;
    parts.push('<path d="' + boxPath + '" fill="none" stroke="' + theme.grid + '"/>');

    parts.push('<text x="' + ((L.left + L.right) / 2) + '" y="' + (height - 8) + '" text-anchor="middle" fill="' + theme.strongText + '" font-size="12">' + escapeHtml(unitLabel(L.bottomUnit)) + '</text>');
    parts.push('<text x="' + ((L.left + L.right) / 2) + '" y="32" text-anchor="middle" fill="' + theme.strongText + '" font-size="12">' + escapeHtml(unitLabel(L.topUnit)) + '</text>');
    parts.push('<text x="14" y="' + ((L.top + L.bottom) / 2) + '" text-anchor="middle" fill="' + theme.strongText + '" font-size="12" transform="rotate(-90 14 ' + ((L.top + L.bottom) / 2) + ')">' + escapeHtml(yAxisTitle()) + '</text>');

    if (customSettings.title && customSettings.title.trim()) {
      parts.push('<text x="' + (width / 2) + '" y="16" text-anchor="middle" fill="' + theme.strongText + '" font-size="13" font-weight="bold">' + escapeHtml(customSettings.title.trim()) + '</text>');
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
      parts.push('<polygon points="' + fillPts + '" fill="' + d.color + '" fill-opacity="0.1"/>');
      parts.push('<polyline points="' + linePts + '" fill="none" stroke="' + d.color + '" stroke-width="2"' + dashAttr + '/>');
    });
    parts.push('</g>');

    var chipY = L.top + 6;
    L.visible.forEach(function (d) {
      var legendText = (d.label && d.label.trim()) || "Spectrum";
      var boxW = legendChipWidth(measureCtx, legendText, "11px " + fontFamily);
      var bx = L.right - boxW - 6, by = chipY;
      var legendDash = dashArrayFor(d.lineStyle);
      var legendDashAttr = legendDash.length ? ' stroke-dasharray="' + legendDash.join(",") + '"' : "";
      parts.push('<rect x="' + bx + '" y="' + by + '" width="' + boxW + '" height="20" fill="' + theme.bgElev + '" fill-opacity="0.85"/>');
      parts.push('<line x1="' + (bx + 6) + '" y1="' + (by + 10) + '" x2="' + (bx + 20) + '" y2="' + (by + 10) + '" stroke="' + d.color + '" stroke-width="2"' + legendDashAttr + '/>');
      parts.push('<text x="' + (bx + 26) + '" y="' + (by + 10) + '" dominant-baseline="middle" fill="' + theme.strongText + '" font-size="11">' + escapeHtml(legendText) + '</text>');
      chipY += 24;
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

  function parseCsvWide(text) {
    var lines = text.split(/\r\n|\n|\r/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    var splitLine = function (line) { return line.split(/[,\t;]/).map(function (s) { return s.trim(); }); };
    if (!lines.length) return { headers: null, rows: [] };

    var firstCells = splitLine(lines[0]);
    var headers = null;
    var startIdx = 0;
    if (!isNumericRow(firstCells)) {
      headers = firstCells;
      startIdx = 1;
    }

    var rows = [];
    var numCols = null;
    for (var i = startIdx; i < lines.length; i++) {
      var cells = splitLine(lines[i]);
      if (!isNumericRow(cells)) continue;
      if (numCols === null) numCols = cells.length;
      if (cells.length !== numCols) continue;
      rows.push(cells.map(function (c) { return parseFloat(c); }));
    }

    return { headers: headers, rows: rows };
  }

  function loadWideIntoDatasets(ds, row, parsed, col1Unit, sourceLabel, source) {
    var rows = parsed.rows;
    if (rows.length < 2 || rows[0].length < 2) {
      return {
        ok: false,
        msg: "Couldn't find at least 2 numeric columns. Expected wavelength (or energy/wavenumber) in column 1, then one or more sample columns."
      };
    }
    var numCols = rows[0].length;
    rows = rows.slice().sort(function (a, b) { return a[0] - b[0]; });
    var xNm = rows.map(function (r) { return convertToNm(r[0], col1Unit); });
    var labels = [];
    var touchedIds = [];

    for (var col = 1; col < numCols; col++) {
      var y = rows.map(function (r) { return r[col]; });
      var headerName = parsed.headers && parsed.headers[col] ? parsed.headers[col] : null;
      var label = headerName || (numCols > 2 ? "Sample " + col : sourceLabel);
      labels.push(label);

      var targetDs, targetRow;
      if (col === 1) {
        targetDs = ds; targetRow = row;
      } else {
        var added = addDataset();
        targetDs = added.ds; targetRow = added.row;
      }
      targetDs.xNm = xNm.slice();
      targetDs.y = y;
      targetDs.colUnit = col1Unit;
      targetDs.source = source;
      touchedIds.push(targetDs.id);
      var legendEl = targetRow.querySelector('[data-role="legend"]');
      if (!legendEl.value.trim()) legendEl.value = label;
      targetDs.label = legendEl.value;
    }

    removeStaleExampleRows(touchedIds);

    var msg = numCols > 2
      ? "Loaded " + (numCols - 1) + " spectra from " + sourceLabel + " (" + labels.join(", ") + "), " + rows.length + " points each."
      : "Loaded " + sourceLabel + " (" + rows.length + " points).";
    return { ok: true, msg: msg };
  }

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
      visible: true,
      colUnit: "nm",
      source: null
    };
    datasets.push(ds);
    return ds;
  }

  function removeDataset(ds) {
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
        return {
          label: d.label, color: d.color, colorAuto: d.colorAuto, paletteIndex: d.paletteIndex,
          offset: d.offset, normalize: d.normalize, lineStyle: d.lineStyle, visible: d.visible,
          colUnit: d.colUnit, source: d.source, xNm: d.xNm, y: d.y
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
    readCustom();

    spectrumMode = project.spectrumMode === "fluorescence" ? "fluorescence" : "absorption";
    modeSelect.value = spectrumMode;
    if (project.axisUnit) axisUnitSelect.value = project.axisUnit;

    (project.datasets || []).forEach(function (saved) {
      var added = addDataset();
      var ds = added.ds, row = added.row;
      ds.xNm = saved.xNm || [];
      ds.y = saved.y || [];
      ds.label = saved.label || "";
      ds.color = saved.color || ds.color;
      ds.colorAuto = !!saved.colorAuto;
      ds.offset = saved.offset || 0;
      ds.normalize = saved.normalize || "none";
      ds.lineStyle = saved.lineStyle || "solid";
      ds.visible = saved.visible !== false;
      ds.colUnit = saved.colUnit || "nm";
      ds.source = saved.source || null;

      row.querySelector('[data-role="color"]').value = ds.color;
      row.querySelector('[data-role="legend"]').value = ds.label;
      row.querySelector('[data-role="col-unit"]').value = ds.colUnit;
      row.querySelector('[data-role="offset"]').value = ds.offset;
      row.querySelector('[data-role="normalize"]').value = ds.normalize;
      row.querySelector('[data-role="line-style"]').value = ds.lineStyle;
      row.querySelector('[data-role="visible"]').checked = ds.visible;
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
    if (!window.confirm("Delete " + label + " (\"" + folder.name + "\")? This cannot be undone.")) return;

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
  }

  function renderFolderTree() {
    folderTreeEl.innerHTML = "";

    if (!folders.length) {
      var empty = document.createElement("p");
      empty.className = "hint spectra-folder-empty-hint";
      empty.textContent = "No projects yet — click \"+ Folder\" to organize spectra by molecule.";
      folderTreeEl.appendChild(empty);
      return;
    }

    function renderNode(folder, depth) {
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
  }

  function createDatasetRow(ds) {
    var frag = rowTemplate.content.cloneNode(true);
    var row = frag.querySelector(".spectra-dataset-row");
    row.dataset.dsId = ds.id;

    var colorInput = row.querySelector('[data-role="color"]');
    var legendInput = row.querySelector('[data-role="legend"]');
    var exampleBtn = row.querySelector('[data-role="example-btn"]');
    var fileInput = row.querySelector('[data-role="file-input"]');
    var pasteToggleBtn = row.querySelector('[data-role="paste-toggle-btn"]');
    var pasteTextarea = row.querySelector('[data-role="paste-textarea"]');
    var pasteLoadBtn = row.querySelector('[data-role="paste-load-btn"]');
    var colUnitSelect = row.querySelector('[data-role="col-unit"]');
    var offsetInput = row.querySelector('[data-role="offset"]');
    var normalizeSelect = row.querySelector('[data-role="normalize"]');
    var lineStyleSelect = row.querySelector('[data-role="line-style"]');
    var visibleInput = row.querySelector('[data-role="visible"]');
    var downloadBtn = row.querySelector('[data-role="download-btn"]');
    var removeBtn = row.querySelector('[data-role="remove-btn"]');

    colorInput.value = ds.color;
    lineStyleSelect.value = ds.lineStyle;

    function applyLoadResult(result, defaultLabel) {
      if (!result.ok) { setRowStatus(row, result.msg, true); return; }
      if (!legendInput.value.trim()) legendInput.value = defaultLabel;
      ds.label = legendInput.value;
      setRowStatus(row, result.msg, false);
      draw();
    }

    colorInput.addEventListener("input", function () {
      ds.color = colorInput.value;
      ds.colorAuto = false;
      draw();
    });

    legendInput.addEventListener("input", function () {
      ds.label = legendInput.value;
      draw();
    });

    exampleBtn.addEventListener("click", function () {
      fileInput.value = "";
      var ex = generateExample();
      ds.xNm = ex.xNm; ds.y = ex.y; ds.source = "example";
      applyLoadResult({
        ok: true,
        msg: "Loaded " + ex.label + " (" + ex.xNm.length + " points). Approximate shape for demonstration — not measured data."
      }, ex.label);
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = parseCsvWide(String(reader.result));
        var result = loadWideIntoDatasets(ds, row, parsed, colUnitSelect.value, file.name, "file");
        setRowStatus(row, result.msg, !result.ok);
        if (result.ok) draw();
      };
      reader.onerror = function () { setRowStatus(row, "Could not read that file.", true); };
      reader.readAsText(file);
    });

    pasteToggleBtn.addEventListener("click", function () {
      var showing = !pasteTextarea.hidden;
      pasteTextarea.hidden = showing;
      pasteLoadBtn.hidden = showing;
      if (!showing) pasteTextarea.focus();
    });

    pasteLoadBtn.addEventListener("click", function () {
      var parsed = parseCsvWide(pasteTextarea.value);
      var result = loadWideIntoDatasets(ds, row, parsed, colUnitSelect.value, "pasted data", "paste");
      setRowStatus(row, result.msg, !result.ok);
      if (result.ok) draw();
    });

    offsetInput.addEventListener("input", function () {
      var v = parseFloat(offsetInput.value);
      ds.offset = isFinite(v) ? v : 0;
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

    removeBtn.addEventListener("click", function () {
      removeDataset(ds);
      row.remove();
      if (!datasets.length) setStatus("No spectra loaded.", false);
      draw();
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

  [titleInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput, bgCustomInput].forEach(function (el) {
    el.addEventListener("input", function () {
      readCustom();
      draw();
    });
  });

  [closedBoxInput, xGridInput, yGridInput].forEach(function (el) {
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
    [titleInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput].forEach(function (el) {
      el.value = "";
    });
    readCustom();
    draw();
  });

  pngBtn.addEventListener("click", function () {
    canvas.toBlob(function (blob) {
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

  dataBtn.addEventListener("click", function () {
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
    if (!any) return;
    var csv = rows.map(function (r) { return r.map(escapeCsvCell).join(","); }).join("\r\n");
    downloadBlob("spectra-visible-" + unit.replace("-", "") + ".csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  });

  globalUploadInput.addEventListener("change", function () {
    var file = globalUploadInput.files[0];
    if (!file) return;
    var added = addDataset();
    var rowFileInput = added.row.querySelector('[data-role="file-input"]');
    var dt = new DataTransfer();
    dt.items.add(file);
    rowFileInput.files = dt.files;
    rowFileInput.dispatchEvent(new Event("change"));
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
    datasets.length = 0;
    datasetsContainer.innerHTML = "";
    setStatus("No spectra loaded.", false);
    draw();
  });

  newFolderBtn.addEventListener("click", function () {
    createFolder(null);
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

  function loadDefaultDemoView() {
    var first = addDataset();
    first.row.querySelector('[data-role="example-btn"]').click();
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
