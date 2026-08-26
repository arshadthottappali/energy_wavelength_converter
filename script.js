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

  var canvas = document.getElementById("spectra-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var tooltip = document.getElementById("spectra-tooltip");
  var statusEl = document.getElementById("spectra-status");
  var axisUnitSelect = document.getElementById("spectra-axis-unit");
  var colUnitSelect = document.getElementById("spectra-col-unit");
  var fileInput = document.getElementById("spectra-file");
  var exampleBtn = document.getElementById("spectra-example-btn");
  var pngBtn = document.getElementById("spectra-png-btn");
  var csvBtn = document.getElementById("spectra-csv-btn");

  var titleInput = document.getElementById("spectra-title");
  var legendInput = document.getElementById("spectra-legend");
  var xMinInput = document.getElementById("spectra-xmin");
  var xMaxInput = document.getElementById("spectra-xmax");
  var xStepInput = document.getElementById("spectra-xstep");
  var yMinInput = document.getElementById("spectra-ymin");
  var yMaxInput = document.getElementById("spectra-ymax");
  var yStepInput = document.getElementById("spectra-ystep");
  var resetAxesBtn = document.getElementById("spectra-reset-axes-btn");

  var state = { xNm: [], y: [], label: "" };
  var custom = { title: "", legend: "", xMin: null, xMax: null, xStep: null, yMin: null, yMax: null, yStep: null };
  var plotBox = null;
  var padLeft = 58, padRight = 16, padTop = 56, padBottom = 46;

  function numOrNull(el) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : null;
  }

  function readCustom() {
    custom.title = titleInput.value;
    custom.legend = legendInput.value;
    custom.xMin = numOrNull(xMinInput);
    custom.xMax = numOrNull(xMaxInput);
    custom.xStep = numOrNull(xStepInput);
    custom.yMin = numOrNull(yMinInput);
    custom.yMax = numOrNull(yMaxInput);
    custom.yStep = numOrNull(yStepInput);
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

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("status-error", !!isError);
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

  function draw() {
    if (!state.xNm.length) return;
    var dims = layout();
    var width = dims.width, height = dims.height;
    var bottomUnit = axisUnitSelect.value;
    var topUnit = getPairUnit(bottomUnit);

    ctx.clearRect(0, 0, width, height);

    var rootStyles = getComputedStyle(document.documentElement);
    var textColor = rootStyles.getPropertyValue("--text-dim").trim() || "#9aa3b5";
    var strongText = rootStyles.getPropertyValue("--text").trim() || "#e6e9f0";
    var lineColor = rootStyles.getPropertyValue("--accent").trim() || "#5eead4";
    var gridColor = rootStyles.getPropertyValue("--border").trim() || "#232838";
    var fontFamily = getComputedStyle(document.body).fontFamily;

    var xVals = state.xNm.map(function (nm) { return convertFromNm(nm, bottomUnit); });
    var autoXMin = Math.min.apply(null, xVals);
    var autoXMax = Math.max.apply(null, xVals);
    if (autoXMin === autoXMax) { autoXMin -= 1; autoXMax += 1; }
    var autoYMax = Math.max.apply(null, state.y) * 1.12 || 1;

    var xMin = custom.xMin != null ? custom.xMin : autoXMin;
    var xMax = custom.xMax != null ? custom.xMax : autoXMax;
    if (xMin === xMax) xMax = xMin + 1;
    var yMin = custom.yMin != null ? custom.yMin : 0;
    var yMax = custom.yMax != null ? custom.yMax : autoYMax;
    if (yMax <= yMin) yMax = yMin + 1;

    var left = padLeft, right = width - padRight, top = padTop, bottom = height - padBottom;
    var plotW = right - left, plotH = bottom - top;

    function xPix(v) { return left + ((v - xMin) / (xMax - xMin)) * plotW; }
    function yPix(v) { return bottom - ((v - yMin) / (yMax - yMin)) * plotH; }

    plotBox = {
      left: left, right: right, top: top, bottom: bottom,
      xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax,
      bottomUnit: bottomUnit, xPix: xPix, yPix: yPix
    };

    ctx.font = "11px " + fontFamily;

    var yTicks = stepTicks(yMin, yMax, custom.yStep) || niceTicks(yMin, yMax, 5);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach(function (t) {
      if (t < yMin - 1e-9 || t > yMax + 1e-9) return;
      var py = yPix(t);
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = textColor;
      ctx.fillText(t.toFixed(2), left - 8, py);
    });

    var xTicks = stepTicks(xMin, xMax, custom.xStep) || niceTicks(xMin, xMax, 6);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach(function (t) {
      if (t < xMin - 1e-9 || t > xMax + 1e-9) return;
      var px = xPix(t);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.15;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = textColor;
      ctx.fillText(formatVal(t, bottomUnit), px, bottom + 8);
    });

    var nmAtXMin = convertToNm(xMin, bottomUnit);
    var nmAtXMax = convertToNm(xMax, bottomUnit);
    var topAtXMin = convertFromNm(nmAtXMin, topUnit);
    var topAtXMax = convertFromNm(nmAtXMax, topUnit);
    var topLo = Math.min(topAtXMin, topAtXMax);
    var topHi = Math.max(topAtXMin, topAtXMax);
    var topTicks = niceTicks(topLo, topHi, 5);
    ctx.textBaseline = "bottom";
    topTicks.forEach(function (tv) {
      if (tv < topLo - 1e-9 || tv > topHi + 1e-9) return;
      var nmEquiv = convertToNm(tv, topUnit);
      var bottomEquiv = convertFromNm(nmEquiv, bottomUnit);
      if (bottomEquiv < xMin - 1e-9 || bottomEquiv > xMax + 1e-9) return;
      var px = xPix(bottomEquiv);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top - 5);
      ctx.strokeStyle = textColor;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = textColor;
      ctx.fillText(formatVal(tv, topUnit), px, top - 7);
    });

    ctx.strokeStyle = gridColor;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    ctx.fillStyle = strongText;
    ctx.font = "12px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(unitLabel(bottomUnit), (left + right) / 2, height - 8);
    ctx.fillText(unitLabel(topUnit), (left + right) / 2, 32);

    ctx.save();
    ctx.translate(14, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Absorbance (a.u.)", 0, 0);
    ctx.restore();

    if (custom.title && custom.title.trim()) {
      ctx.fillStyle = strongText;
      ctx.font = "bold 13px " + fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(custom.title.trim(), width / 2, 16);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, plotW, plotH);
    ctx.clip();

    ctx.beginPath();
    state.xNm.forEach(function (nm, i) {
      var xv = convertFromNm(nm, bottomUnit);
      var px = xPix(xv), py = yPix(state.y[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(xPix(convertFromNm(state.xNm[state.xNm.length - 1], bottomUnit)), bottom);
    ctx.lineTo(xPix(convertFromNm(state.xNm[0], bottomUnit)), bottom);
    ctx.closePath();
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.08;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    var legendText = (custom.legend && custom.legend.trim()) || state.label;
    if (legendText) {
      ctx.font = "11px " + fontFamily;
      var swatchW = 14, boxPad = 6;
      var textW = ctx.measureText(legendText).width;
      var boxW = swatchW + boxPad * 2 + textW + 6;
      var bx = right - boxW - 6, by = top + 6;
      ctx.fillStyle = rootStyles.getPropertyValue("--bg-elev").trim() || "#11151f";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, by, boxW, 20);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + boxPad, by + 10);
      ctx.lineTo(bx + boxPad + swatchW, by + 10);
      ctx.stroke();
      ctx.fillStyle = strongText;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(legendText, bx + boxPad + swatchW + 6, by + 10);
    }
  }

  function nearestIndex(nmTarget) {
    var lo = 0, hi = state.xNm.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (state.xNm[mid] < nmTarget) lo = mid + 1; else hi = mid;
    }
    if (lo > 0 && Math.abs(state.xNm[lo - 1] - nmTarget) < Math.abs(state.xNm[lo] - nmTarget)) return lo - 1;
    return lo;
  }

  canvas.addEventListener("mousemove", function (e) {
    if (!plotBox || !state.xNm.length) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (mx < plotBox.left || mx > plotBox.right) { tooltip.style.display = "none"; return; }
    var bottomVal = plotBox.xMin + ((mx - plotBox.left) / (plotBox.right - plotBox.left)) * (plotBox.xMax - plotBox.xMin);
    var nmTarget = convertToNm(bottomVal, plotBox.bottomUnit);
    var idx = nearestIndex(nmTarget);
    var nm = state.xNm[idx], yVal = state.y[idx];
    var ev = convertFromNm(nm, "eV"), cm1 = convertFromNm(nm, "cm-1");
    tooltip.style.display = "block";
    tooltip.style.left = plotBox.xPix(convertFromNm(nm, plotBox.bottomUnit)) + "px";
    tooltip.style.top = Math.min(plotBox.yPix(yVal), my) + "px";
    tooltip.innerHTML = formatVal(nm, "nm") + " nm &middot; " + formatVal(ev, "eV") + " eV &middot; " +
      formatVal(cm1, "cm-1") + " cm⁻¹<br>Absorbance: " + yVal.toFixed(3);
  });

  canvas.addEventListener("mouseleave", function () {
    tooltip.style.display = "none";
  });

  function parseCsvText(text) {
    var lines = text.split(/\r\n|\n|\r/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    var rows = [];
    lines.forEach(function (line) {
      var parts = line.split(/[,\t;]/).map(function (s) { return s.trim(); });
      if (parts.length < 2) return;
      var a = parseFloat(parts[0]), b = parseFloat(parts[1]);
      if (isFinite(a) && isFinite(b)) rows.push([a, b]);
    });
    return rows;
  }

  function loadFromRows(rows, col1Unit, label) {
    if (rows.length < 2) {
      setStatus("Couldn't find at least 2 numeric rows. Expected two columns: value, absorbance.", true);
      return false;
    }
    var pts = rows.map(function (r) { return [convertToNm(r[0], col1Unit), r[1]]; });
    pts.sort(function (a, b) { return a[0] - b[0]; });
    state.xNm = pts.map(function (p) { return p[0]; });
    state.y = pts.map(function (p) { return p[1]; });
    state.label = label;
    setStatus("Loaded " + label + " (" + pts.length + " points).", false);
    return true;
  }

  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCsvText(String(reader.result));
      if (loadFromRows(rows, colUnitSelect.value, file.name)) draw();
    };
    reader.onerror = function () { setStatus("Could not read that file.", true); };
    reader.readAsText(file);
  });

  exampleBtn.addEventListener("click", function () {
    fileInput.value = "";
    var ex = generateExampleSpectrum();
    state.xNm = ex.xNm; state.y = ex.y; state.label = ex.label;
    setStatus("Loaded " + ex.label + " (" + ex.xNm.length + " points). Approximate shape for demonstration — not measured data.", false);
    draw();
  });

  axisUnitSelect.addEventListener("change", function () {
    xMinInput.value = ""; xMaxInput.value = ""; xStepInput.value = "";
    readCustom();
    draw();
  });

  [titleInput, legendInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput].forEach(function (el) {
    el.addEventListener("input", function () {
      readCustom();
      draw();
    });
  });

  resetAxesBtn.addEventListener("click", function () {
    [titleInput, legendInput, xMinInput, xMaxInput, xStepInput, yMinInput, yMaxInput, yStepInput].forEach(function (el) {
      el.value = "";
    });
    readCustom();
    draw();
  });

  pngBtn.addEventListener("click", function () {
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "absorption-spectrum.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  });

  csvBtn.addEventListener("click", function () {
    if (!state.xNm.length) return;
    var unit = axisUnitSelect.value;
    var rows = [[unitLabel(unit), "Absorbance"]];
    state.xNm.forEach(function (nm, i) {
      rows.push([convertFromNm(nm, unit).toFixed(unit === "nm" ? 2 : 4), state.y[i]]);
    });
    var csv = rows.map(function (r) { return r.join(","); }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "absorption-spectrum-" + unit.replace("-", "") + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  window.addEventListener("resize", function () {
    if (state.xNm.length) draw();
  });

  var initial = generateExampleSpectrum();
  state.xNm = initial.xNm; state.y = initial.y; state.label = initial.label;
  setStatus("Loaded " + initial.label + " (" + initial.xNm.length + " points). Approximate shape for demonstration — not measured data.", false);
  draw();
})();
