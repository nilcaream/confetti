(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

  const cfgUi = [];

  let autofire = false;

  const add = (key, label, value1, description1, value2, description2) => cfgUi.push({
    key: key,
    label: label,
    value1: value1,
    value2: value2,
    default1: value1,
    default2: value2,
    description1: description1,
    description2: description2,
  });

  add(false, "Configuration", "min", undefined, "max");

  add("cfg.count", "Papers count", 60, "Minimum number of papers per shot", 80, "Maximum number of papers per shot");

  add(false, "Fadout time");

  add("cfg.fade.t0", "Fade start [s]", 2, "Time after papers start to fade out");
  add("cfg.fade.t1", "Fade end [s]", 3, "Time after papers completely disappear");

  add(false, "Rotation");

  add("cfg.rotation.shift", "Axis shit [px]", 5, "Minimum radius for paper rotation", 10, "Maximum radius for paper rotation");
  add("cfg.rotation.zoom", "Speed", -2, "Minimum paper rotation speed. Negative means counterclockwise", 2, "Maximum paper rotation speed");

  add(false, "Paper size");

  add("cfg.size.height", "Height [px]", 6, "Parallelogram height");
  add("cfg.size.width", "Width [px]", 10, "Parallelogram base");
  add("cfg.size.skew", "Lean [px]", 4, "Parallelogram lean. Zero means rectangle");
  add("cfg.size.wobble.zoom", "Wobble speed", 4, "Minimum 3D-like wobble speed", 6, "Maximum 3D-like wobble speed");

  add(false, "Initial velocity");

  add("cfg.v0.angle", "Fire angle [deg]", -45, "Minimum angle at which paper is fired (spread)", 45, "Maximum angle at which paper is fired (spread)");
  add("cfg.v0.length", "Fire speed [px/s]", 30, "Minimum paper initial speed", 100, "Maximum paper initial speed");
  add("cfg.v0.multiplier", "Speed multiplier", 3, "Minimum speed multiplier", 5, "Maximum speed multiplier");
  add("cfg.v0.variation", "Speed variation [px]", 20, "Minimum additional initial speed", 90, "Maximum additional initial speed");
  add("cfg.v0.threshold", "Threshold [px]", 10, "Minimum mouse-drawn line length to fire confetti");

  add(false, "Physics");

  add("cfg.physics.g", "Gravity [px/s^2]", 90, "Downward acceleration value");
  add("cfg.physics.vT", "Terminal velocity [px/s]", 60, "Velocity at which the air drag force balances the gravitational force");

  const sendData = (key, value) => {
    chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
      const message = {};
      message[key] = value;
      chrome.tabs.sendMessage(tabs[0].id, message);
    });
  };

  const createTd = (key, value, base, description, colspan) => {
    const td = document.createElement("td");
    td.setAttribute("colspan", colspan.toString());
    td.classList.add("input");

    const input = document.createElement("input");
    input.value = value;
    input.setAttribute("id", key);
    input.setAttribute("title", `${description}. Default: ${base}`);
    input.addEventListener("input", () => {
      if (input.value.trim().length && !isNaN(input.value)) {
        console.log(`${key} = ${input.value}`);
        sendData("update", { key: key, value: parseFloat(input.value) });
      }
    });

    td.append(input);
    return td;
  };

  const addButtonsActions = () => {
    document.getElementById("autofire").addEventListener("click", () => autofire = !autofire);

    document.getElementById("reset").addEventListener("click", () => {
      const update = (key, value) => {
        const input = document.getElementById(key);
        if (input) {
          input.value = value;
          input.dispatchEvent(new Event("input"));
        }
      };
      cfgUi.filter(c => c.key).forEach(c => {
        update(c.key, c.default1);
        update(c.key + ".range-min", c.default1);
        update(c.key + ".range-max", c.default2);
      });
    });

    setInterval(() => {
      if (autofire) {
        sendData("autofire", true);
      }
    }, 300);
  };

  const updateCfg = (key, value) => {
    const parts = (key || "").toString().split(".").filter(x => typeof x === "string");

    if (parts.length < 2) {
      console.log("Invalid key: " + key);
      return;
    }
    if (isNaN(value)) {
      console.log("Invalid value: " + value);
      return;
    }

    const pointer = parts.slice(0, parts.length - 1);
    const parameter = parts[parts.length - 1];
    const holder = cfgUi.filter(c => c.key === pointer.join("."))[0] || {};

    if (parameter === "range-min") {
      holder.value1 = value;
    } else if (parameter === "range-max") {
      holder.value2 = value;
    } else {
      holder.value1 = value;
    }
  }

  const loadCfg = () => {
    return chrome.storage.local.get(["configuration"]).then(result => {
      if (result.configuration) {
        console.log("Storage configuration");
        console.log(result.configuration);
        Object.entries(result.configuration).forEach(([key, value]) => updateCfg(key, value));
      }
    });
  };

  const populateTable = () => {
    const table = document.getElementById("configuration");

    cfgUi.forEach(cfgEntry => {
      const tr = document.createElement("tr");
      if (cfgEntry.key) {
        const td = document.createElement("td");
        td.classList.add("label");
        td.textContent = cfgEntry.label;
        tr.append(td);

        if (cfgEntry.value2 === undefined) {
          tr.append(createTd(cfgEntry.key, cfgEntry.value1, cfgEntry.default1, cfgEntry.description1, 2));
        } else {
          tr.append(createTd(cfgEntry.key + ".range-min", cfgEntry.value1, cfgEntry.default1, cfgEntry.description1, 1));
          tr.append(createTd(cfgEntry.key + ".range-max", cfgEntry.value2, cfgEntry.default2, cfgEntry.description2, 1));
        }
      } else {
        const td1 = document.createElement("td");
        td1.textContent = cfgEntry.label;
        const td2 = document.createElement("td");
        td2.textContent = cfgEntry.value1;
        td2.classList.add("tac");
        const td3 = document.createElement("td");
        td3.textContent = cfgEntry.value2;
        td3.classList.add("tac");

        tr.append(td1);
        tr.append(td2);
        tr.append(td3);

        tr.classList.add("spacer");
      }

      table.append(tr);
    });
  };

  loadCfg().then(() => {
    populateTable();
    addButtonsActions();
  });

});
