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
