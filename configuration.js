(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

  const id = "nc-confetti-everywhere-cfg";

  const extension = (chrome || {}).storage !== undefined;

  const log = m => console.log(`[${id}${extension ? "-ext" : ""}] ${m}`);

  const cfgUi = [];

  let autofire = false;
  let initialized = false;

  const add = (key, label, description1, description2) => cfgUi.push({
    key: key,
    label: label,
    description1: description1,
    description2: description2,
    value1: false,
    value2: false,
    default1: false,
    default2: false
  });

  add(false, "Configuration", "min", "max");

  add("cfg.count", "Papers count", "Minimum number of papers per shot", "Maximum number of papers per shot");

  add(false, "Fadout time");

  add("cfg.fade.t0", "Fade start [s]", "Time after papers start to fade out");
  add("cfg.fade.t1", "Fade end [s]", "Time after papers completely disappear");

  add(false, "Rotation");

  add("cfg.rotation.shift", "Axis shit [px]", "Minimum radius for paper rotation", "Maximum radius for paper rotation");
  add("cfg.rotation.zoom", "Speed", "Minimum paper rotation speed. Negative means counterclockwise", "Maximum paper rotation speed");

  add(false, "Paper size");

  add("cfg.size.height", "Height [px]", "Parallelogram height");
  add("cfg.size.width", "Width [px]", "Parallelogram base");
  add("cfg.size.skew", "Lean [px]", "Parallelogram lean. Zero means rectangle");
  add("cfg.size.wobble.zoom", "Wobble speed", "Minimum 3D-like wobble speed", "Maximum 3D-like wobble speed");

  add(false, "Initial velocity");

  add("cfg.v0.angle", "Fire angle [deg]", "Minimum angle at which paper is fired (spread)", "Maximum angle at which paper is fired (spread)");
  add("cfg.v0.length", "Fire speed [px/s]", "Minimum paper initial speed", "Maximum paper initial speed");
  add("cfg.v0.multiplier", "Speed multiplier", "Minimum speed multiplier", "Maximum speed multiplier");
  add("cfg.v0.variation", "Speed variation [px]", "Minimum additional initial speed", "Maximum additional initial speed");
  add("cfg.v0.threshold", "Threshold [px]", "Minimum mouse-drawn line length to fire confetti");

  add(false, "Physics");

  add("cfg.physics.g", "Gravity [px/s^2]", "Downward acceleration value");
  add("cfg.physics.vT", "Terminal velocity [px/s]", "Velocity at which the air drag force balances the gravitational force");

  add("cfg.ui.showFps");
  add("cfg.ui.invertColors");

  const updateClass = (element, toAdd, toRemove, invert = false) => {
    element.classList.add(invert ? toRemove : toAdd);
    element.classList.remove(invert ? toAdd : toRemove);
  };

  const sendMessage = (key, value) => {
    const message = {};
    message[key] = value;

    log(`sending ${JSON.stringify(message).substring(0, 64)}`);

    if (extension) {
      chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
        chrome.tabs.sendMessage(tabs[0].id, message).then(() => { }, e => {
          if ((e || "").toString().toLowerCase().indexOf("receiving end does not exist") !== -1) {
            log(`confetti page is not available`);
          } else {
            throw e;
          }
        });
      });
    } else {
      window.top.postMessage(JSON.stringify(message), "*");
    }
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
        input.classList.remove("error");
        log(`${key} = ${input.value}`);
        sendMessage("update", { key: key, value: parseFloat(input.value) });
        if (parseFloat(input.value).toFixed(2) === base.toFixed(2)) {
          input.classList.add("default");
        } else {
          input.classList.remove("default");
        }
      } else {
        input.classList.add("error");
      }
    });

    if (parseFloat(input.value).toFixed(2) === base.toFixed(2)) {
      input.classList.add("default");
    }

    td.append(input);
    return td;
  };

  const updateButtonColor = (key, enabled) => {
    const button = document.getElementById(key);
    if (button) {
      updateClass(button, "enabled", "disabled", !enabled);
    }
  }

  const toggleBoolean = key => {
    const holder = cfgUi.filter(c => c.key === key)[0];
    if (holder) {
      holder.value1 = !holder.value1;
      updateCfg(holder.key, holder.value1);
      updateButtonColor(holder.value1);
      log(`${holder.key} = ${holder.value1}`);
      sendMessage("update", { key: holder.key, value: holder.value1 });
    } else {
      log("invalid key: " + key);
    }
  };

  const resetBoolean = key => {
    const holder = cfgUi.filter(c => c.key === key)[0];
    if (holder) {
      holder.value1 = holder.default1;
      updateCfg(holder.key, holder.value1);
      sendMessage("update", { key: holder.key, value: holder.value1 });
    } else {
      log("invalid key: " + key);
    }
  };

  const addButtonsActions = () => {
    document.getElementById("autofire").addEventListener("click", e => {
      autofire = !autofire;
      updateClass(e.target, "enabled", "disabled", !autofire);
    });

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

      resetBoolean("cfg.ui.showFps");

      document.querySelectorAll("input").forEach(input => updateClass(input, "default", "error"));
    });

    document.getElementById("cfg.ui.showFps").addEventListener("click", () => toggleBoolean("cfg.ui.showFps"));
    document.getElementById("cfg.ui.invertColors").addEventListener("click", () => toggleBoolean("cfg.ui.invertColors"));

    setInterval(() => {
      if (autofire) {
        sendMessage("autofire", true);
      }
    }, 300);
  };

  const updateCfg = (key, value, target1, target2) => {
    const parts = (key || "").toString().split(".").filter(x => typeof x === "string");

    if (parts.length < 2) {
      log("invalid key: " + key);
      return;
    }
    if (isNaN(value)) {
      log("invalid value: " + value);
      return;
    }

    const pointer = parts.slice(0, parts.length - 1).join(".");
    const parameter = parts[parts.length - 1];
    const holder = cfgUi.filter(c => c.key === pointer)[0];

    const singleValuePointer = pointer + "." + parameter;
    const singleValueHolder = cfgUi.filter(c => c.key === singleValuePointer)[0];

    if (singleValueHolder !== undefined) {
      singleValueHolder[target1] = value;
      updateButtonColor(key, value);
    } else if (holder !== undefined) {
      if (parameter === "range-min") {
        holder[target1] = value;
      } else if (parameter === "range-max") {
        holder[target2] = value;
      } else {
        log(`unknown parameter ${parameter} for key ${key}`);
      }
    } else {
      log(`unknown key: ${key}`);
    }
  }

  const applyCfg = (data, target1, target2) => {
    Object.entries(data).forEach(([key, value]) => {
      log(`applying ${key} = ${value} on ${target1} or ${target2}`);
      updateCfg(key, value, target1, target2);
    });
  };

  const populateTable = () => {
    const table = document.getElementById("configuration");

    cfgUi.forEach(cfgEntry => {
      const tr = document.createElement("tr");
      if (cfgEntry.key && cfgEntry.label) {
        const td = document.createElement("td");
        td.classList.add("label");
        td.textContent = cfgEntry.label;
        tr.append(td);

        if (cfgEntry.description2 === undefined) {
          tr.append(createTd(cfgEntry.key, cfgEntry.value1, cfgEntry.default1, cfgEntry.description1, 2));
        } else {
          tr.append(createTd(cfgEntry.key + ".range-min", cfgEntry.value1, cfgEntry.default1, cfgEntry.description1, 1));
          tr.append(createTd(cfgEntry.key + ".range-max", cfgEntry.value2, cfgEntry.default2, cfgEntry.description2, 1));
        }
      } else if (cfgEntry.label) {
        const td1 = document.createElement("td");
        td1.textContent = cfgEntry.label;
        const td2 = document.createElement("td");
        td2.textContent = cfgEntry.description1;
        td2.classList.add("tac");
        const td3 = document.createElement("td");
        td3.textContent = cfgEntry.description2;
        td3.classList.add("tac");

        tr.append(td1);
        tr.append(td2);
        tr.append(td3);

        tr.classList.add("spacer");
      }

      table.append(tr);
    });
  };

  const consumeMessage = message => {
    log(`received ${JSON.stringify(message).substring(0, 64)}`);

    if (message.defaults && message.configuration && !initialized) {
      initialized = true;

      log("processing defaults");
      applyCfg(message.defaults, "default1", "default2")

      log("processing configuration");
      applyCfg(message.configuration, "value1", "value2")

      populateTable();
      addButtonsActions();
      log("initialized");
    } else if (message.show) {
      const rect = document.body.getBoundingClientRect();
      sendMessage("size", {
        width: rect.left + rect.right,
        height: rect.bottom + rect.top
      });
    }
  };

  const startMessageListener = () => {
    if (extension) {
      chrome.runtime.onMessage.addListener(consumeMessage);
    } else {
      window.addEventListener("message", m => consumeMessage(JSON.parse(m.data)));
    }
  };

  // --------------------------------

  startMessageListener();
  sendMessage("show", true);

});
